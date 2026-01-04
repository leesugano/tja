"use client";

import React from "react";
import { Timer } from "lucide-react";
import type { ParseResult } from "../lib/tja";

type DiagnosticsPanelProps = {
  diagnostics: Pick<ParseResult, "errors" | "warnings">;
};

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  return (
    <section className="panel rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">Diagnostics</h2>
          <p className="text-xs text-ink-500">Live validation & warnings</p>
        </div>
        <Timer className="h-4 w-4 text-ink-400" />
      </div>
      <div className="space-y-2 text-xs">
        {diagnostics.errors.length === 0 &&
          diagnostics.warnings.length === 0 && (
            <div className="rounded-xl border border-white/60 bg-white/70 p-3 text-ink-500">
              No diagnostics. Chart is ready for preview.
            </div>
          )}
        {diagnostics.errors.map((error) => (
          <div
            key={`error-${error.line}-${error.message}`}
            className="rounded-xl border border-salmon-500/30 bg-salmon-500/10 p-3 text-salmon-600"
          >
            Line {error.line || "--"}: {error.message}
          </div>
        ))}
        {diagnostics.warnings.map((warning) => (
          <div
            key={`warn-${warning.line}-${warning.message}`}
            className="rounded-xl border border-tide-500/30 bg-tide-500/10 p-3 text-tide-700"
          >
            Line {warning.line || "--"}: {warning.message}
          </div>
        ))}
      </div>
    </section>
  );
}
