import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function sanitizeTitle(value: string) {
  const trimmed = value.trim();
  const noSeparators = trimmed.replace(/[\\/]/g, "-").replace(/\.\.+/g, ".");
  return noSeparators || "Chart";
}

function normalizeOffsetToSeconds(tja: string) {
  const newline = tja.includes("\r\n") ? "\r\n" : "\n";
  const lines = tja.split(/\r?\n/);
  const index = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith("OFFSET:")
  );
  if (index === -1) return tja;

  const rawValue = lines[index].split(/:(.+)/)[1];
  const rawNumber = rawValue ? Number(rawValue.trim()) : Number.NaN;
  if (!Number.isFinite(rawNumber)) return tja;

  const shouldConvert = Math.abs(rawNumber) > 20;
  const secondsValue = shouldConvert ? rawNumber / 1000 : rawNumber;
  const formatted = secondsValue.toFixed(3).replace(/\.?0+$/, "");
  lines[index] = `OFFSET:${formatted}`;
  return lines.join(newline);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const titleRaw = formData.get("title");
  const tja = formData.get("tja");

  if (typeof titleRaw !== "string" || typeof tja !== "string") {
    return NextResponse.json(
      { error: "Missing title or tja content." },
      { status: 400 }
    );
  }

  const safeTitle = sanitizeTitle(titleRaw);
  const targetDir = path.join(process.cwd(), "public", safeTitle);
  await mkdir(targetDir, { recursive: true });

  const tjaPath = path.join(targetDir, `${safeTitle}.tja`);
  const normalizedTja = normalizeOffsetToSeconds(tja);
  await writeFile(tjaPath, normalizedTja, "utf8");

  const audio = formData.get("audio");
  if (audio && audio instanceof File) {
    const originalName = audio.name || "audio.ogg";
    const ext = path.extname(originalName) || ".ogg";
    const audioPath = path.join(targetDir, `${safeTitle}${ext}`);
    const buffer = Buffer.from(await audio.arrayBuffer());
    await writeFile(audioPath, buffer);
  }

  return NextResponse.json({ ok: true, folder: safeTitle });
}
