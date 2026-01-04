"use client";

import React, { useRef } from "react";
import { highlightTja } from "../lib/tja";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  errorsCount: number;
  warningsCount: number;
};

export function CodeEditor({
  value,
  onChange,
  errorsCount,
  warningsCount
}: CodeEditorProps) {
  const editorInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editorScrollRef = useRef<HTMLPreElement | null>(null);

  const handleEditorScroll = () => {
    if (!editorInputRef.current || !editorScrollRef.current) return;
    editorScrollRef.current.scrollTop = editorInputRef.current.scrollTop;
    editorScrollRef.current.scrollLeft = editorInputRef.current.scrollLeft;
  };

  return (
    <section className="panel rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">TJA Code Editor</h2>
          <p className="text-xs text-ink-500">
            Real-time syntax highlighting, validation, and metadata sync
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge">{errorsCount} errors</span>
          <span className="badge">{warningsCount} warnings</span>
        </div>
      </div>
      <div className="editor-wrap">
        <pre
          className="editor-highlight"
          ref={editorScrollRef}
          dangerouslySetInnerHTML={{ __html: highlightTja(value) }}
        />
        <textarea
          ref={editorInputRef}
          className="editor-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleEditorScroll}
          spellCheck={false}
          aria-label="TJA code"
        />
      </div>
    </section>
  );
}
