import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "gemini-3-flash-preview";

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = match?.[1]?.trim() ?? trimmed;
  const braceStart = candidate.indexOf("{");
  const bracketStart = candidate.indexOf("[");
  if (braceStart === -1 && bracketStart === -1) return candidate;
  const start =
    braceStart === -1
      ? bracketStart
      : bracketStart === -1
        ? braceStart
        : Math.min(braceStart, bracketStart);
  const end =
    start === braceStart
      ? candidate.lastIndexOf("}")
      : candidate.lastIndexOf("]");
  if (end !== -1) {
    return candidate.slice(start, end + 1).trim();
  }
  return candidate;
}

function normalizeJson(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/,\s*([}\]])/g, "$1");
}

function parseLooseGemini(text: string) {
  const bpmMatch = text.match(/"bpm"\s*:\s*([0-9.]+)/);
  const offsetMatch = text.match(/"offsetMs"\s*:\s*([0-9.-]+)/);
  const bpm = bpmMatch ? Number(bpmMatch[1]) : null;
  const offsetMs = offsetMatch ? Number(offsetMatch[1]) : 0;
  const events: { timeSec: number; type: "don" | "katsu" }[] = [];
  const eventRegex =
    /"timeSec"\s*:\s*([0-9.]+)\s*,\s*"type"\s*:\s*"(don|katsu)"/g;
  for (const match of text.matchAll(eventRegex)) {
    const timeSec = Number(match[1]);
    const type = match[2] as "don" | "katsu";
    if (Number.isFinite(timeSec)) {
      events.push({ timeSec, type });
    }
    if (events.length >= 2000) break;
  }
  if (!Number.isFinite(bpm)) {
    return null;
  }
  return {
    bpm,
    offsetMs: Number.isFinite(offsetMs) ? offsetMs : 0,
    events
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "audio/wav";

  const prompt = `You are an expert rhythm-game chart analyst. Analyze the audio and return ONLY JSON with:
- bpm: number (float)
- offsetMs: number (milliseconds, positive if notes should start later)
- events: array of { timeSec: number, type: "don" | "katsu" }
Limit to the main beat-driven hits and keep events under 1200.
No extra text, no markdown.`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message || "Gemini request failed" },
      { status: response.status }
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json(
      { error: "Gemini response missing content" },
      { status: 502 }
    );
  }

  try {
    const json = JSON.parse(normalizeJson(extractJson(text)));
    return NextResponse.json(json);
  } catch {
    const fallback = parseLooseGemini(text);
    if (fallback) {
      return NextResponse.json(fallback);
    }
    console.error("Gemini JSON parse failed", { text });
    return NextResponse.json(
      { error: "Failed to parse Gemini JSON" },
      { status: 502 }
    );
  }
}
