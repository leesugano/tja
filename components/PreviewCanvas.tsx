"use client";

import React, { useCallback, useEffect, useRef } from "react";
import type { Note, NoteType } from "../lib/tja";
import { HIT_WINDOWS_MS } from "../lib/tja";
import { useResizeObserver } from "../hooks/useResizeObserver";

type JudgeResult = "Perfect" | "Good" | "Ok" | "Miss" | "";

type PreviewCanvasProps = {
  notes: Note[];
  bpm: number;
  offset: number;
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onJudge: (result: {
    judge: JudgeResult;
    latency: number | null;
    combo: number;
  }) => void;
};

export function PreviewCanvas({
  notes,
  bpm,
  offset,
  audioRef,
  isPlaying,
  onJudge
}: PreviewCanvasProps) {
  const { ref, rect, node } = useResizeObserver<HTMLCanvasElement>();
  const animationRef = useRef<number | null>(null);
  const hitsRef = useRef(new Map<string, JudgeResult>());
  const comboRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getTime = () => audioRef.current?.currentTime ?? 0;

  const playHitSound = useCallback((type: NoteType) => {
    const context =
      audioContextRef.current ??
      new AudioContext();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }

    const isKatsu = type === "katsu" || type === "katsu-big";
    const isBig = type === "don-big" || type === "katsu-big";
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = isKatsu ? "square" : "triangle";
    osc.frequency.value = isKatsu ? 360 : 150;
    gain.gain.value = 0.0001;

    const now = context.currentTime;
    const peak = isBig ? 0.5 : 0.35;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }, []);

  const drawFrame = useCallback(() => {
    if (!node) return;
    const canvas = node;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;

    const deviceRatio = window.devicePixelRatio || 1;
    canvas.width = width * deviceRatio;
    canvas.height = height * deviceRatio;
    ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);

    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0b1220");
    bg.addColorStop(1, "#0b1a2b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const trackY = height / 2;
    const laneHeight = Math.min(120, height * 0.6);
    const laneTop = trackY - laneHeight / 2;
    const laneBottom = trackY + laneHeight / 2;
    const lane = ctx.createLinearGradient(0, laneTop, 0, laneBottom);
    lane.addColorStop(0, "rgba(18, 28, 45, 0.9)");
    lane.addColorStop(0.5, "rgba(22, 36, 56, 0.95)");
    lane.addColorStop(1, "rgba(18, 28, 45, 0.9)");
    ctx.fillStyle = lane;
    ctx.fillRect(0, laneTop, width, laneHeight);

    ctx.strokeStyle = "rgba(99, 116, 145, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, laneTop);
    ctx.lineTo(width, laneTop);
    ctx.moveTo(0, laneBottom);
    ctx.lineTo(width, laneBottom);
    ctx.stroke();

    const hitX = width * 0.18;
    ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hitX, laneTop + 6);
    ctx.lineTo(hitX, laneBottom - 6);
    ctx.stroke();

    const speed = 260;
    const now = getTime();
    const safeBpm = bpm > 0 ? bpm : 120;
    const beatSeconds = 60 / safeBpm;
    const currentBeat = beatSeconds > 0 ? (now - offset / 1000) / beatSeconds : 0;
    const startBeat = Math.floor(currentBeat) - 8;
    const endBeat = startBeat + 24;

    for (let beat = startBeat; beat <= endBeat; beat += 1) {
      const beatTime = beat * beatSeconds + offset / 1000;
      const delta = beatTime - now;
      const x = hitX + delta * speed;
      if (x < -20 || x > width + 20) continue;
      const isMeasure = beat % 4 === 0;
      ctx.strokeStyle = isMeasure
        ? "rgba(255, 255, 255, 0.28)"
        : "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = isMeasure ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, laneTop + 10);
      ctx.lineTo(x, laneBottom - 10);
      ctx.stroke();
    }

    notes.forEach((note) => {
      const noteTime = (note.beat / safeBpm) * 60 + offset / 1000;
      const delta = noteTime - now;
      const x = hitX + delta * speed;
      if (x < -20 || x > width + 20) return;
      const hitState = hitsRef.current.get(note.id);
      if (hitState) return;
      const isDon = note.type === "don" || note.type === "don-big";
      const isBig = note.type === "don-big" || note.type === "katsu-big";
      ctx.fillStyle = isDon ? "#ff5c4d" : "#2f85f7";
      ctx.beginPath();
      ctx.arc(x, trackY, isBig ? 18 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = isBig ? 3 : 2;
      ctx.strokeStyle = isDon
        ? "rgba(255, 229, 214, 0.8)"
        : "rgba(207, 232, 255, 0.8)";
      ctx.stroke();
      const shine = isDon
        ? "rgba(255, 244, 235, 0.7)"
        : "rgba(230, 244, 255, 0.7)";
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(x - 4, trackY - 4, isBig ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hitX, trackY, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(hitX - 7, trackY - 7, 14, 14);

    animationRef.current = requestAnimationFrame(drawFrame);
  }, [audioRef, bpm, node, notes, offset, rect.height, rect.width]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(drawFrame);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [drawFrame, isPlaying]);

  useEffect(() => {
    hitsRef.current.clear();
    comboRef.current = 0;
  }, [notes]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (["f", "j", "d", "k"].includes(event.key.toLowerCase())) {
        const now = getTime();
        const safeBpm = bpm > 0 ? bpm : 120;
        const noteWindow = notes
          .filter((note) => !hitsRef.current.get(note.id))
          .map((note) => {
            const noteTime = (note.beat / safeBpm) * 60 + offset / 1000;
            return { note, delta: (now - noteTime) * 1000 };
          })
          .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];

        if (!noteWindow) return;
        const latency = noteWindow.delta;
        const absLatency = Math.abs(latency);
        let judge: JudgeResult = "";
        if (absLatency <= HIT_WINDOWS_MS.Perfect) {
          judge = "Perfect";
        } else if (absLatency <= HIT_WINDOWS_MS.Good) {
          judge = "Good";
        } else if (absLatency <= HIT_WINDOWS_MS.Ok) {
          judge = "Ok";
        } else {
          judge = "Miss";
        }

        if (judge !== "Miss") {
          hitsRef.current.set(noteWindow.note.id, judge);
          comboRef.current += 1;
          playHitSound(noteWindow.note.type);
        } else {
          comboRef.current = 0;
        }
        onJudge({ judge, latency, combo: comboRef.current });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [bpm, notes, offset, onJudge]);

  return (
    <canvas
      ref={ref}
      className="preview-canvas rounded-2xl"
      aria-label="Chart preview"
    />
  );
}
