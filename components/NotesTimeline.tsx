"use client";

import React from "react";
import type { Note, NoteType } from "../lib/tja";
import { formatBpm, formatMillis } from "../lib/ui";
import { useResizeObserver } from "../hooks/useResizeObserver";

type NotesTimelineProps = {
  notes: Note[];
  onToggleNote: (beat: number) => void;
  noteType: NoteType;
  bpm: number;
  offset: number;
  snapDivisions: number;
};

export function NotesTimeline({
  notes,
  onToggleNote,
  noteType,
  bpm,
  offset,
  snapDivisions
}: NotesTimelineProps) {
  const { ref, rect } = useResizeObserver<HTMLDivElement>();
  const totalBeats = 64;
  const beatWidth = rect.width > 0 ? rect.width / totalBeats : 0;
  const stepPerBeat = snapDivisions / 4;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!rect.width) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const rawBeat = x / beatWidth;
    const snapped = Math.round(rawBeat * stepPerBeat) / stepPerBeat;
    onToggleNote(snapped);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>Measure Snap {snapDivisions}/4</span>
        <span>
          {formatBpm(bpm)} • Offset {formatMillis(offset)}
        </span>
      </div>
      <div
        ref={ref}
        onClick={handleClick}
        className="timeline-grid relative h-28 overflow-hidden rounded-2xl border border-white/40 bg-white/60"
        role="button"
        aria-label="Note timeline"
      >
        {notes.map((note) => {
          const x = note.beat * beatWidth;
          const isDon = note.type === "don" || note.type === "don-big";
          const isBig = note.type === "don-big" || note.type === "katsu-big";
          return (
            <div
              key={note.id}
              className={`absolute rounded-full ${
                isDon ? "bg-salmon-500" : "bg-tide-500"
              } ${isBig ? "top-5 h-12 w-6" : "top-6 h-10 w-4"}`}
              style={{ left: x - (isBig ? 12 : 8) }}
              title={`${note.type} @ beat ${note.beat.toFixed(2)}`}
            />
          );
        })}
        <div className="absolute inset-x-0 bottom-3 flex justify-between px-2 text-[10px] text-ink-400">
          <span>0</span>
          <span>16</span>
          <span>32</span>
          <span>48</span>
          <span>64</span>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-ink-500 shadow">
          Placing: {noteType.replace("-", " ")}
        </div>
      </div>
    </div>
  );
}
