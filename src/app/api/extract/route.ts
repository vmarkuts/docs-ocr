import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedData = "";
    let isImage = false;

    if (file.type === "application/pdf") {
      const parsed = await pdfParse(buffer);
      extractedData = parsed.text;
    } else if (file.type === "text/csv" || file.type === "text/plain") {
      extractedData = buffer.toString("utf-8");
    } else if (file.type.startsWith("image/")) {
      extractedData = buffer.toString("base64");
      isImage = true;
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OpenRouter API Key in server environment" }, { status: 500 });
    }

    const primaryModel = "google/gemini-2.5-flash:free";
    const fallbackModel = "meta-llama/llama-3-8b-instruct:free";

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

    let payload = {
      model: primaryModel,
      messages: [{ role: "user", content: contentArray }]
    };

    let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      if (isImage) {
        throw new Error("Primary model failed. Fallback model does not support images.");
      }
      payload.model = fallbackModel;
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      throw new Error(`OpenRouter API completely failed: ${await res.text()}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    
    const cleanJsonStr = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsedResults = JSON.parse(cleanJsonStr);
      return NextResponse.json(parsedResults);
    } catch (parseError) {
      const jsonMatch = cleanJsonStr.match(/\[.*\]/s);
      if (jsonMatch) {
         return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
      throw new Error("Could not parse AI response as JSON: " + cleanJsonStr);
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
