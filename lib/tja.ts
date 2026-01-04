export type NoteType = "don" | "katsu" | "don-big" | "katsu-big";

export type Note = {
  id: string;
  beat: number;
  type: NoteType;
};

export type TjaMetadata = {
  title: string;
  bpm: number;
  offset: number;
  course: string;
  level: number;
  balloon: number[];
  wave: string;
};

export type ParseResult = {
  meta: TjaMetadata;
  notes: Note[];
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
};

export const DEFAULT_TJA = `TITLE:New Taiko Chart\nBPM:120\nOFFSET:0\nCOURSE:Oni\nLEVEL:7\nBALLOON:16,16\nWAVE:audio.ogg\n\n#START\n0010001000100010,\n0000000000000000,\n#END\n`;

export const DEFAULT_META: TjaMetadata = {
  title: "New Taiko Chart",
  bpm: 120,
  offset: 0,
  course: "Oni",
  level: 7,
  balloon: [16, 16],
  wave: "audio.ogg"
};

export const HIT_WINDOWS_MS = {
  Perfect: 28,
  Good: 70,
  Ok: 110
};

export function highlightTja(code: string) {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("//")) {
        return `<span class=\"token-comment\">${line}</span>`;
      }
      if (line.trim().startsWith("#")) {
        return line.replace(
          /(#\w+)/g,
          '<span class=\"token-directive\">$1</span>'
        );
      }
      if (line.includes(":")) {
        const [key, rest] = line.split(/:(.+)/);
        return `<span class=\"token-key\">${key}</span>:${rest ?? ""}`;
      }
      return line.replace(/[1-4]/g, '<span class=\"token-note\">$&</span>');
    })
    .join("\n");
}

export function updateHeaderValue(source: string, key: string, value: string) {
  const lines = source.split("\n");
  const index = lines.findIndex((line) =>
    line.toUpperCase().startsWith(`${key.toUpperCase()}:`)
  );
  const nextLine = `${key.toUpperCase()}:${value}`;
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    const insertAt = Math.max(
      0,
      lines.findIndex((line) => line.trim().startsWith("#START"))
    );
    lines.splice(insertAt, 0, nextLine);
  }
  return lines.join("\n");
}

export function replaceNotesSection(source: string, notesBlock: string) {
  const startIndex = source.indexOf("#START");
  const endIndex = source.indexOf("#END");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return `${source.trim()}\n\n#START\n${notesBlock}\n#END\n`;
  }
  const before = source.slice(0, startIndex);
  const after = source.slice(endIndex + "#END".length);
  return `${before}#START\n${notesBlock}\n#END${after}`;
}

export function buildNotesBlock(notes: Note[], divisions = 16) {
  if (!notes.length) {
    return "0".repeat(divisions) + ",";
  }
  const maxBeat = Math.max(...notes.map((note) => note.beat));
  const measures = Math.max(1, Math.ceil((maxBeat + 0.001) / 4));
  const block: string[] = [];

  for (let measure = 0; measure < measures; measure += 1) {
    const slots = Array.from({ length: divisions }, () => "0");
    notes
      .filter((note) => Math.floor(note.beat / 4) === measure)
      .forEach((note) => {
        const beatInMeasure = note.beat - measure * 4;
        const index = Math.min(
          divisions - 1,
          Math.max(0, Math.round((beatInMeasure / 4) * divisions))
        );
        let token = "1";
        if (note.type === "katsu") token = "2";
        if (note.type === "don-big") token = "3";
        if (note.type === "katsu-big") token = "4";
        slots[index] = token;
      });
    block.push(`${slots.join("")},`);
  }

  return block.join("\n");
}

export function buildTjaFromMeta(
  meta: TjaMetadata,
  notes: Note[],
  divisions = 16
) {
  let tja = DEFAULT_TJA;
  tja = updateHeaderValue(tja, "TITLE", meta.title);
  tja = updateHeaderValue(tja, "BPM", meta.bpm.toString());
  tja = updateHeaderValue(tja, "OFFSET", meta.offset.toString());
  tja = updateHeaderValue(tja, "COURSE", meta.course);
  tja = updateHeaderValue(tja, "LEVEL", meta.level.toString());
  tja = updateHeaderValue(tja, "BALLOON", meta.balloon.join(","));
  tja = updateHeaderValue(tja, "WAVE", meta.wave);
  const notesBlock = buildNotesBlock(notes, divisions);
  tja = replaceNotesSection(tja, notesBlock);
  return tja;
}

export function quantizeNotes(notes: Note[], divisions = 16) {
  if (!notes.length) return [] as Note[];
  const stepPerBeat = divisions / 4;
  const bucket = new Map<number, NoteType>();
  notes.forEach((note) => {
    const snapped = Math.round(note.beat * stepPerBeat) / stepPerBeat;
    const existing = bucket.get(snapped);
    if (!existing) {
      bucket.set(snapped, note.type);
      return;
    }

    const isExistingKatsu = existing === "katsu" || existing === "katsu-big";
    const isIncomingKatsu = note.type === "katsu" || note.type === "katsu-big";
    if (isExistingKatsu !== isIncomingKatsu) {
      bucket.set(snapped, "katsu");
      return;
    }
    if (existing === "don" && note.type === "don-big") {
      bucket.set(snapped, "don-big");
    } else if (existing === "katsu" && note.type === "katsu-big") {
      bucket.set(snapped, "katsu-big");
    }
  });
  return Array.from(bucket.entries())
    .map(([beat, type]) => ({ id: `${beat.toFixed(3)}-${type}`, beat, type }))
    .sort((a, b) => a.beat - b.beat);
}

export function parseTja(text: string): ParseResult {
  const lines = text.split("\n");
  const errors: ParseResult["errors"] = [];
  const warnings: ParseResult["warnings"] = [];
  const meta: TjaMetadata = { ...DEFAULT_META };
  const notes: Note[] = [];
  let inNotes = false;
  let buffer = "";
  let measureIndex = 0;
  let lineNumber = 0;

  lines.forEach((line, index) => {
    lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("//")) {
      return;
    }

    if (trimmed.toUpperCase().startsWith("TITLE:")) {
      meta.title = trimmed.split(/:(.+)/)[1]?.trim() ?? meta.title;
      return;
    }
    if (trimmed.toUpperCase().startsWith("BPM:")) {
      const bpmValue = Number(trimmed.split(/:(.+)/)[1]);
      if (Number.isNaN(bpmValue)) {
        errors.push({ line: lineNumber, message: "Invalid BPM value" });
      } else {
        meta.bpm = bpmValue;
      }
      return;
    }
    if (trimmed.toUpperCase().startsWith("OFFSET:")) {
      const offsetValue = Number(trimmed.split(/:(.+)/)[1]);
      if (Number.isNaN(offsetValue)) {
        errors.push({ line: lineNumber, message: "Invalid OFFSET value" });
      } else {
        meta.offset = offsetValue;
      }
      return;
    }
    if (trimmed.toUpperCase().startsWith("COURSE:")) {
      meta.course = trimmed.split(/:(.+)/)[1]?.trim() ?? meta.course;
      return;
    }
    if (trimmed.toUpperCase().startsWith("LEVEL:")) {
      const levelValue = Number(trimmed.split(/:(.+)/)[1]);
      if (Number.isNaN(levelValue)) {
        errors.push({ line: lineNumber, message: "Invalid LEVEL value" });
      } else {
        meta.level = levelValue;
      }
      return;
    }
    if (trimmed.toUpperCase().startsWith("BALLOON:")) {
      const sequence = trimmed.split(/:(.+)/)[1] ?? "";
      meta.balloon = sequence
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value));
      return;
    }
    if (trimmed.toUpperCase().startsWith("WAVE:")) {
      meta.wave = trimmed.split(/:(.+)/)[1]?.trim() ?? meta.wave;
      return;
    }

    if (trimmed.startsWith("#")) {
      if (trimmed.toUpperCase().startsWith("#START")) {
        inNotes = true;
        return;
      }
      if (trimmed.toUpperCase().startsWith("#END")) {
        inNotes = false;
        if (buffer) {
          buffer
            .split("")
            .forEach((token, tokenIndex) => {
              if (token === "0") return;
              if (!["1", "2", "3", "4"].includes(token)) {
                warnings.push({
                  line: lineNumber,
                  message: `Unsupported note token: ${token}`
                });
                return;
              }
              const beat = measureIndex * 4 + (tokenIndex / buffer.length) * 4;
              notes.push({
                id: `${measureIndex}-${tokenIndex}`,
                beat,
                type:
                  token === "4"
                    ? "katsu-big"
                    : token === "3"
                      ? "don-big"
                      : token === "2"
                        ? "katsu"
                        : "don"
              });
            });
          buffer = "";
          measureIndex += 1;
        }
        return;
      }
      if (trimmed.toUpperCase().startsWith("#MEASURE")) {
        warnings.push({
          line: lineNumber,
          message: "#MEASURE is not fully supported in visual editor"
        });
        return;
      }
    }

    if (inNotes) {
      const lineNotes = trimmed.replace(/\s/g, "");
      const hasComma = lineNotes.includes(",");
      buffer += lineNotes.replace(/,/g, "");
      if (hasComma) {
        const noteTokens = buffer.split("");
        noteTokens.forEach((token, tokenIndex) => {
          if (token === "0") return;
          if (!["1", "2", "3", "4"].includes(token)) {
            warnings.push({
              line: lineNumber,
              message: `Unsupported note token: ${token}`
            });
            return;
          }
          const beat = measureIndex * 4 + (tokenIndex / noteTokens.length) * 4;
          notes.push({
            id: `${measureIndex}-${tokenIndex}`,
            beat,
            type:
              token === "4"
                ? "katsu-big"
                : token === "3"
                  ? "don-big"
                  : token === "2"
                    ? "katsu"
                    : "don"
          });
        });
        buffer = "";
        measureIndex += 1;
      }
      return;
    }
  });

  if (!text.includes("#START")) {
    errors.push({ line: 0, message: "Missing #START directive" });
  }
  if (!text.includes("#END")) {
    errors.push({ line: 0, message: "Missing #END directive" });
  }

  return { meta, notes, errors, warnings };
}
