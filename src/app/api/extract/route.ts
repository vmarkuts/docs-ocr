import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, payload: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`));
      }

      function sendError(msg: string) {
        sendEvent("error", { message: msg });
        controller.close();
      }

      try {
        sendEvent("log", { message: "Reading uploaded document..." });
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          return sendError("No file provided");
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedData = "";
        let isImage = false;

        if (file.type === "application/pdf") {
          sendEvent("log", { message: "Parsing PDF file..." });
          const PDFParser = require("pdf2json");
          const pdfParser = new PDFParser(null, 1);
          
          extractedData = await new Promise<string>((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)));
            pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
            pdfParser.parseBuffer(buffer);
          });
        } else if (file.type === "text/csv" || file.type === "text/plain") {
          extractedData = buffer.toString("utf-8");
        } else if (file.type.startsWith("image/")) {
          extractedData = buffer.toString("base64");
          isImage = true;
        } else {
          return sendError("Unsupported file type");
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        if (!OPENROUTER_API_KEY) {
          return sendError("Missing OpenRouter API Key in server environment");
        }

        const modelsToTry = [
          "google/gemma-4-26b-a4b-it:free",
          "nvidia/nemotron-3-super-120b-a12b:free",
          "minimax/minimax-m2.5:free",
          "liquid/lfm-2.5-1.2b-instruct:free"
        ];

        const promptText = `
Extract the items from this supplier quote. Return ONLY a valid JSON array matching this schema perfectly: 
[
  {
    "item": "string (name of item)",
    "qty": number (quantity, 1 if not specified),
    "unit_price": number (price per unit, parse as float),
    "vendor": "string (name of supplier or Vendor Unknown)"
  }
]
No markdown wrapping, no extra text. Just the raw JSON array.
`;

        let contentArray: any[] = [];
        if (isImage) {
          contentArray = [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: `data:${file.type};base64,${extractedData}` } }
          ];
        } else {
          contentArray = [
            { type: "text", text: promptText + "\n\nData:\n" + extractedData }
          ];
        }

        let success = false;

        for (const model of modelsToTry) {
          sendEvent("status", { model, status: "trying" });
          
          let payload = {
            model: model,
            messages: [{ role: "user", content: contentArray }]
          };

          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 15000); // 15s max per model

          try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload),
              signal: abortController.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
              const errText = await res.text();
              let reason = "failed";
              try {
                const errObj = JSON.parse(errText);
                if (errObj.error?.code === 429) reason = "rate limit";
                else if (res.status >= 500) reason = "overloaded";
                else reason = errObj.error?.message || "error";
              } catch (_) { }
              
              sendEvent("status", { model, status: "failed", reason });
              continue;
            }

            const data = await res.json();
            const rawContent = data.choices?.[0]?.message?.content || "";
            const cleanJsonStr = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

            let parsedResults = null;
            try {
              parsedResults = JSON.parse(cleanJsonStr);
            } catch (parseError) {
              const jsonMatch = cleanJsonStr.match(/\[.*\]/s);
              if (jsonMatch) {
                parsedResults = JSON.parse(jsonMatch[0]);
              } else {
                sendEvent("status", { model, status: "failed", reason: "invalid JSON response" });
                continue;
              }
            }

            sendEvent("status", { model, status: "success" });
            sendEvent("result", { payload: parsedResults });
            success = true;
            controller.close();
            return;

          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            const isTimeout = fetchErr.name === 'AbortError' || fetchErr.message.includes('timeout');
            sendEvent("status", { model, status: "failed", reason: isTimeout ? "timeout" : "network error" });
            continue;
          }
        }

        if (!success) {
          sendError("All free AI models are completely overloaded. Please try again later.");
        }

      } catch (err: any) {
        sendError(err.message);
      }
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
