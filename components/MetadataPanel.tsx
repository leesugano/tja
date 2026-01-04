"use client";

import React from "react";
import type { TjaMetadata } from "../lib/tja";

type MetadataPanelProps = {
  meta: TjaMetadata;
  onUpdate: (key: keyof TjaMetadata, value: string) => void;
};

export function MetadataPanel({ meta, onUpdate }: MetadataPanelProps) {
  return (
    <section className="panel rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">Metadata</h2>
          <p className="text-xs text-ink-500">Structured chart properties</p>
        </div>
      </div>
      <div className="space-y-3 text-xs">
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-ink-600">Title</span>
          <input
            className="input"
            value={meta.title}
            onChange={(event) => onUpdate("title", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-ink-600">Balloon Sequence</span>
          <input
            className="input"
            value={meta.balloon.join(",")}
            onChange={(event) => onUpdate("balloon", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-ink-600">Audio File</span>
          <input
            className="input"
            value={meta.wave}
            onChange={(event) => onUpdate("wave", event.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
