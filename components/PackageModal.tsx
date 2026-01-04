"use client";

import React from "react";

type PackageModalProps = {
  title: string;
  audioName: string | null;
  outputPath: string;
  status: "idle" | "working" | "done" | "error";
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function PackageModal({
  title,
  audioName,
  outputPath,
  status,
  error,
  onClose,
  onConfirm
}: PackageModalProps) {
  const displayTitle = title?.trim() || "Chart";
  const buttonLabel =
    status === "working" ? "Building…" : status === "done" ? "Build Again" : "Build";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="panel w-full max-w-md rounded-2xl p-6">
        <h3 className="text-base font-semibold text-ink-900">Build Chart Files</h3>
        <p className="mt-2 text-xs text-ink-500">
          Save TJA + audio files under the public folder for local playtesting.
        </p>
        <div className="mt-4 grid gap-2 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
            <span>Chart title</span>
            <span className="font-semibold text-ink-700">{displayTitle}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
            <span>Audio</span>
            <span className="font-semibold text-ink-700">{audioName ?? "None"}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
            <span>Output</span>
            <span className="font-semibold text-ink-700">{outputPath}</span>
          </div>
        </div>
        {status === "done" && (
          <div className="mt-3 text-[11px] font-semibold text-ink-600">
            Files built successfully.
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-salmon-500/30 bg-salmon-500/10 p-2 text-[11px] text-salmon-600">
            {error}
          </div>
        )}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="button" onClick={onClose}>
            Close
          </button>
          <button
            className="button button-primary"
            onClick={onConfirm}
            disabled={status === "working"}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
