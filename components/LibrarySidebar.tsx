"use client";

import React from "react";
import {
  ChevronDown,
  Copy,
  Folder,
  Gauge,
  Plus
} from "lucide-react";

type ChartEntry = {
  id: string;
  name: string;
  updatedAt: string;
};

type LibrarySidebarProps = {
  charts: ChartEntry[];
  activeChartId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  latency: number | null;
  judge: string;
};

export function LibrarySidebar({
  charts,
  activeChartId,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  latency,
  judge
}: LibrarySidebarProps) {
  const [showContextId, setShowContextId] = React.useState<string | null>(null);

  return (
    <aside className="panel flex flex-col gap-4 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-800">Library</h2>
        <button className="button button-muted" onClick={onAdd}>
          <Plus className="inline h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {charts.map((chart) => (
          <div
            key={chart.id}
            className={`relative rounded-xl border px-3 py-2 text-xs font-medium transition ${
              activeChartId === chart.id
                ? "border-transparent bg-ink-900 text-white"
                : "border-white/40 bg-white/70 text-ink-700"
            }`}
          >
            <div
              className="block w-full text-left"
              role="button"
              tabIndex={0}
              onClick={() => onSelect(chart.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(chart.id);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span>{chart.name}</span>
                <button
                  className="rounded-full p-1 hover:bg-white/20"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowContextId((prev) => (prev === chart.id ? null : chart.id));
                  }}
                  aria-label="Chart menu"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1 text-[10px] text-ink-400">
                {Number.isNaN(Date.parse(chart.updatedAt))
                  ? chart.updatedAt
                  : new Date(chart.updatedAt).toLocaleString()}
              </div>
            </div>
            {showContextId === chart.id && (
              <div className="absolute right-2 top-12 z-10 w-36 rounded-xl border border-white/50 bg-white/90 p-2 text-xs shadow-lg">
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-ink-700 hover:bg-ink-100"
                  onClick={() => {
                    onDuplicate(chart.id);
                    setShowContextId(null);
                  }}
                >
                  <Copy className="h-3 w-3" />
                  Duplicate
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-ink-700 hover:bg-ink-100"
                  onClick={() => {
                    onRemove(chart.id);
                    setShowContextId(null);
                  }}
                >
                  <Folder className="h-3 w-3" />
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="panel-subtle rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-600">
          <Gauge className="h-4 w-4" />
          Performance
        </div>
        <div className="mt-2 space-y-2 text-[11px] text-ink-500">
          <div className="flex items-center justify-between">
            <span>Refresh</span>
            <span className="badge">120Hz ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Latency</span>
            <span className="badge">
              {latency ? `${latency.toFixed(1)} ms` : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Judge</span>
            <span className="badge">{judge || "--"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
