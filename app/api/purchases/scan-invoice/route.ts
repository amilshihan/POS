import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/auth";

export const runtime = "nodejs";

const EXTRACTION_PROMPT = `You are reading a scanned supplier purchase invoice for a spare parts shop. Extract its details as JSON only, no prose, matching exactly this shape:

{
  "supplier": { "name": string | null, "phone": string | null, "address": string | null },
  "invoice_number": string | null,
  "invoice_date": string | null,  // ISO format YYYY-MM-DD if you can determine it, else null
  "items": [
    {
      "name": string,            // product name/description as printed
      "sku": string | null,      // code/SKU/part number if printed
      "qty": number,
      "unit_cost": number,       // the NET price actually paid per single unit, i.e. (list price per unit - discount per unit). This is list price AFTER discount is applied — never the undiscounted list price.
      "discount": number,        // the TOTAL discount for this whole line, in currency, for all units combined — NOT a percentage and NOT a per-unit amount. Kept for the record; not used to recompute the total.
      "retail_price": number | null  // a suggested/listed retail price if the invoice prints one explicitly; otherwise fall back to the line's undiscounted list price (the before-discount per-unit price), never the discounted unit_cost; null only if no list/retail price of any kind is printed
    }
  ],
  "subtotal": number | null,
  "discount_total": number | null,
  "total": number | null
}

Work "unit_cost" and "discount" out from whatever the invoice shows, so that qty * unit_cost always equals the line's printed Amount/Total:
- If the invoice prints a separate "List Price" (or "Rate"/"Unit Price") column AND a lower, already-discounted "Price"/"Net Price" per unit, set unit_cost = that lower, already-discounted per-unit price, and set discount = qty * (list_price - unit_cost).
- If the invoice prints a discount as a PERCENTAGE (e.g. "30.00 %") against a single list price per unit, compute unit_cost = list_price * (1 - percent / 100), and discount = qty * list_price * (percent / 100).
- If the invoice prints a per-unit discount amount (not a percent) against a single list price, compute unit_cost = list_price - that per-unit discount, and discount = qty * that per-unit discount.
- If the invoice already prints a line-level discount amount (not per-unit, not a percent) alongside one unit price, treat that one printed unit price as the list price: unit_cost = list_price - (discount / qty), discount stays as printed.
- If there is no discount at all for that line, unit_cost = the single unit price printed, discount = 0.
Never leave "discount" as a raw percentage number (e.g. never output 30 to mean "30%") — always convert it to the final currency amount for the whole line. Always double-check: qty * unit_cost should equal the invoice's printed Amount/Total for that line.

Read every line item on the invoice. If a value isn't present or legible, use null (or 0 for numeric discount). Do not invent data. Respond with ONLY the JSON object, no markdown fences, no commentary.`;

export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserAndProfile();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Invoice scanning isn't set up yet. Add ANTHROPIC_API_KEY to the server's .env.local and restart." },
      { status: 400 }
    );
  }

  let body: { base64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.base64 || !body.mediaType) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const isPdf = body.mediaType === "application/pdf";
  const isImage = body.mediaType.startsWith("image/");
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "Only images or PDF invoices are supported." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: body.base64 },
                }
              : {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: body.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                    data: body.base64,
                  },
                },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("The scan didn't return readable data. Try a clearer photo.");
    }
    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ extracted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the invoice." },
      { status: 500 }
    );
  }
}
