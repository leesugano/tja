"use client";

import React, { useEffect } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";

type WaveformProps = {
  audioBuffer: AudioBuffer | null;
};

export function Waveform({ audioBuffer }: WaveformProps) {
  const { ref, rect, node } = useResizeObserver<HTMLCanvasElement>();

  useEffect(() => {
    if (!audioBuffer || !node) return;
    const canvas = node;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (!width || !height) return;

    const deviceRatio = window.devicePixelRatio || 1;
    canvas.width = width * deviceRatio;
    canvas.height = height * deviceRatio;
    ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(59, 68, 88, 0.08)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(47, 133, 247, 0.9)";
    ctx.lineWidth = 1.5;

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(channelData.length / width));
    const middle = height / 2;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      const start = x * step;
      let min = 1;
      let max = -1;
      for (let i = 0; i < step; i += 1) {
        const sample = channelData[start + i] || 0;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      ctx.moveTo(x, middle + min * middle);
      ctx.lineTo(x, middle + max * middle);
    }
    ctx.stroke();
  }, [audioBuffer, node, rect.height, rect.width]);

  if (!audioBuffer) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-white/50 bg-white/60 text-xs text-ink-400">
        Upload audio to see waveform
      </div>
    );
  }

  return (
    <canvas ref={ref} className="wave-canvas rounded-2xl" aria-label="Waveform" />
  );
}
