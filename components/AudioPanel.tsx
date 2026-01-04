"use client";

import React from "react";
import { AudioLines, FileMusic, Sparkles } from "lucide-react";
import { formatBpm, formatMillis } from "../lib/ui";
import type { AudioAnalysis, AutoChartOptions } from "../lib/audio-analysis";
import { Waveform } from "./Waveform";

type AudioPanelProps = {
  audioBuffer: AudioBuffer | null;
  audioName: string | null;
  onUpload: (file: File) => void | Promise<void>;
  analysis: AudioAnalysis | null;
  bpm: number;
  offset: number;
  autoOptions: AutoChartOptions;
  onAutoOptionsChange: (options: AutoChartOptions) => void;
  autoDifficulty: "Easy" | "Normal" | "Hard" | "Oni";
  onAutoDifficultyChange: (value: "Easy" | "Normal" | "Hard" | "Oni") => void;
  onGenerate: () => void;
  generationState: "idle" | "working" | "done";
  autoError?: string | null;
};

export function AudioPanel({
  audioBuffer,
  audioName,
  onUpload,
  analysis,
  bpm,
  offset,
  autoOptions,
  onAutoOptionsChange,
  autoDifficulty,
  onAutoDifficultyChange,
  onGenerate,
  generationState,
  autoError
}: AudioPanelProps) {
  return (
    <div className="panel rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-800">Audio & Timing</h3>
          <p className="text-xs text-ink-500">
            Upload WAV/OGG and auto-detect BPM + offset with waveform guidance
          </p>
        </div>
        <label className="button button-muted w-full cursor-pointer sm:w-auto">
          <input
            type="file"
            accept="audio/ogg,audio/wav"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <FileMusic className="mr-2 inline h-4 w-4" />
          Upload
        </label>
      </div>
      <Waveform audioBuffer={audioBuffer} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-600">BPM</label>
          <div className="flex items-center justify-between rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-xs text-ink-600">
            <span>{formatBpm(bpm)}</span>
            <span className="badge">Auto</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-500">
            <span>
              {analysis?.bpm
                ? `Detected ${formatBpm(analysis.bpm)}`
                : "No suggestion yet"}
            </span>
            <span className="text-[11px] text-ink-400">Automatic</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-600">Offset (ms)</label>
          <div className="flex items-center justify-between rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-xs text-ink-600">
            <span>{formatMillis(offset)}</span>
            <span className="badge">Auto</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-500">
            <span>
              {analysis ? `Detected ${formatMillis(analysis.offsetMs)}` : "No offset yet"}
            </span>
            <span className="text-[11px] text-ink-400">Automatic</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-xs text-ink-600">
        <AudioLines className="h-4 w-4" />
        <span>{audioName ?? "No audio loaded"}</span>
        <span className="ml-auto badge">Auto timing</span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/60 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-ink-700">Auto Chart</h4>
            <p className="text-[11px] text-ink-500">
              Detect onsets, generate Don/Katsu, and sync to BPM
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              className="button button-primary w-full sm:w-auto"
              onClick={onGenerate}
              disabled={!audioBuffer}
            >
              <Sparkles className="mr-2 inline h-4 w-4" />
              {generationState === "working" ? "Analyzing…" : "Generate"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-ink-600">Sensitivity</span>
            <input
              type="range"
              min={0.2}
              max={0.9}
              step={0.05}
              value={autoOptions.sensitivity}
              onChange={(event) =>
                onAutoOptionsChange({
                  ...autoOptions,
                  sensitivity: Number(event.target.value)
                })
              }
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-ink-600">Katsu Bias</span>
            <input
              type="range"
              min={-0.6}
              max={0.6}
              step={0.1}
              value={autoOptions.katsuBias}
              onChange={(event) =>
                onAutoOptionsChange({
                  ...autoOptions,
                  katsuBias: Number(event.target.value)
                })
              }
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-ink-600">Quantization</span>
            <select
              className="input"
              value={autoOptions.snapDivisions}
              onChange={(event) =>
                onAutoOptionsChange({
                  ...autoOptions,
                  snapDivisions: Number(event.target.value)
                })
              }
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-ink-600">Apply Difficulty</span>
            <select
              className="input"
              value={autoDifficulty}
              onChange={(event) =>
                onAutoDifficultyChange(event.target.value as AudioPanelProps["autoDifficulty"])
              }
            >
              <option value="Easy">Easy</option>
              <option value="Normal">Normal</option>
              <option value="Hard">Hard</option>
              <option value="Oni">Oni</option>
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-ink-600">Detected</span>
            <div className="flex items-center gap-2">
              <span className="badge">
                {analysis?.bpm ? formatBpm(analysis.bpm) : "--"}
              </span>
              <span className="badge">
                {analysis ? formatMillis(analysis.offsetMs) : "--"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-ink-500">
          Local analysis runs entirely in your browser.
        </div>
        {generationState === "done" && (
          <div className="mt-2 text-[11px] font-semibold text-ink-600">
            Generated difficulties: Easy, Normal, Hard, Oni. Applied: {autoDifficulty}.
          </div>
        )}
        {autoError && (
          <div className="mt-2 rounded-xl border border-salmon-500/30 bg-salmon-500/10 p-2 text-[11px] text-salmon-600">
            {autoError}
          </div>
        )}
      </div>
    </div>
  );
}
