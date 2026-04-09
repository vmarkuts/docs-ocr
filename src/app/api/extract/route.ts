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
        let providerConfig = { provider: "builtin", apiKey: "", model: "" };
        
        try {
          const configStr = formData.get("providerConfig");
          if (configStr) providerConfig = JSON.parse(configStr.toString());
        } catch(e) {}

        if (!file) return sendError("No file provided");

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

        let modelsToTry: string[] = [];
        let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

        if (providerConfig.provider === "builtin") {
          if (!OPENROUTER_API_KEY) return sendError("Missing Built-in OpenRouter API Key");
          modelsToTry = [
            "google/gemma-4-26b-a4b-it:free",
            "nvidia/nemotron-3-super-120b-a12b:free",
            "minimax/minimax-m2.5:free",
            "liquid/lfm-2.5-1.2b-instruct:free"
          ];
        } else if (providerConfig.provider === "openrouter") {
          if (!providerConfig.apiKey) return sendError("Please provide your OpenRouter API Key");
          OPENROUTER_API_KEY = providerConfig.apiKey;
          modelsToTry = [providerConfig.model || "openrouter/auto"];
        } else if (providerConfig.provider === "openai") {
          if (!providerConfig.apiKey) return sendError("Please provide your OpenAI API Key");
          modelsToTry = [providerConfig.model || "gpt-4o"];
        } else if (providerConfig.provider === "anthropic") {
          if (!providerConfig.apiKey) return sendError("Please provide your Anthropic API Key");
          modelsToTry = [providerConfig.model || "claude-sonnet-4-5"];
        }

        const promptText = `
You are a strict data extraction processor. Your ONLY output must be a valid JSON array. Do not write any conversational text, no explanations, no markdown formatting (do NOT use \`\`\`json).

Extract the line items from the provided supplier quote. Map the data precisely into this JSON array schema:

[
  {
    "item": "string (the name/description of the item)",
    "qty": 1, // number (use 1 if quantity is missing)
    "unit_price": 0.0, // number (the price per unit as float)
    "vendor": "string (supplier name, or 'Vendor Unknown')"
  }
]

CRITICAL RULES:
1. Return ONLY the array starting with '[' and ending with ']'.
2. Ensure valid JSON syntax (no trailing commas, properly escaped quotes).
3. If no items are found, return exactly [].
`;

        let success = false;

        for (const model of modelsToTry) {
          sendEvent("status", { model, status: "trying" });
          
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 25000);

          try {
            let res: Response;

            if (providerConfig.provider === "anthropic") {
              let anthropicContent: any[] = [];
              if (isImage) {
                const b64 = extractedData.includes(",") ? extractedData.split(",")[1] : extractedData;
                anthropicContent = [
                  { type: "image", source: { type: "base64", media_type: file.type, data: b64 } },
                  { type: "text", text: "Please extract items from this quote exactly as instructed." }
                ];
              } else {
                anthropicContent = [ { type: "text", text: "Data to extract:\n" + extractedData } ];
              }

              const payload = {
                model: model,
                max_tokens: 2048,
                system: promptText,
                messages: [{ role: "user", content: anthropicContent }]
              };

              res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "x-api-key": providerConfig.apiKey,
                  "content-type": "application/json",
                  "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify(payload),
                signal: abortController.signal
              });
            } else {
              // OpenAI or OpenRouter logic
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

              const endpoint = providerConfig.provider === "openai" 
                 ? "https://api.openai.com/v1/chat/completions" 
                 : "https://openrouter.ai/api/v1/chat/completions";
              
              const apiKey = providerConfig.provider === "openai" ? providerConfig.apiKey : OPENROUTER_API_KEY;

              const payload = {
                model: model,
                messages: [{ role: "user", content: contentArray }]
              };

              res = await fetch(endpoint, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: abortController.signal
              });
            }

            clearTimeout(timeoutId);

            if (!res.ok) {
              const errText = await res.text();
              let reason = "failed";
              try {
                const errObj = JSON.parse(errText);
                if (errObj.error?.code === 429) reason = "rate limit";
                else if (res.status >= 500) reason = "overloaded";
                else reason = errObj.error?.message || errObj.error?.type || "error";
              } catch (_) { }
              
              sendEvent("status", { model, status: "failed", reason });
              continue; // try next model if available
            }

            const data = await res.json();
            let rawContent = "";
            if (providerConfig.provider === "anthropic") {
              rawContent = data.content?.[0]?.text || "";
            } else {
              rawContent = data.choices?.[0]?.message?.content || "";
            }

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
            sendEvent("status", { model, status: "failed", reason: isTimeout ? "timeout/aborted" : "network error" });
            continue;
          }
        }

        if (!success) {
          sendError(providerConfig.provider === "builtin" 
            ? "All free AI models are completely overloaded. Please try again later."
            : "The API provider failed to process the request.");
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
