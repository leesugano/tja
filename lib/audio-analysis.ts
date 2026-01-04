import type { Note, NoteType } from "./tja";

export type Peak = {
  time: number;
  energy: number;
};

export type AudioAnalysis = {
  bpm: number | null;
  offsetMs: number;
  peaks: Peak[];
};

export type AutoChartOptions = {
  snapDivisions: number;
  sensitivity: number;
  katsuBias: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

export function analyzeAudio(
  buffer: AudioBuffer,
  sensitivity = 0.6
): AudioAnalysis {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = 1024;
  const hopSize = 512;
  const energies: number[] = [];

  for (let i = 0; i < channel.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize && i + j < channel.length; j += 1) {
      const sample = channel[i + j];
      sum += sample * sample;
    }
    energies.push(Math.sqrt(sum / windowSize));
  }

  const smoothed = smoothValues(energies, 3);
  const sorted = [...smoothed].sort((a, b) => a - b);
  const p60 = sorted[Math.floor(sorted.length * 0.6)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? p60;
  const weight = 1 - clamp(sensitivity, 0.2, 0.95);
  const threshold = p60 + (p90 - p60) * weight;
  const peaks: Peak[] = [];
  for (let i = 1; i < smoothed.length - 1; i += 1) {
    if (
      smoothed[i] > threshold &&
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] >= smoothed[i + 1]
    ) {
      peaks.push({
        time: (i * hopSize) / sampleRate,
        energy: smoothed[i]
      });
    }
  }

  const bpm = estimateTempo(peaks);
  const offsetMs = bpm ? estimateOffsetMs(peaks, bpm) : 0;

  return { bpm, offsetMs, peaks };
}

export function estimateTempo(peaks: Peak[]) {
  if (peaks.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i += 1) {
    const delta = peaks[i].time - peaks[i - 1].time;
    if (delta > 0.2 && delta < 2) intervals.push(delta);
  }
  if (!intervals.length) return null;
  const bpmBuckets = new Map<number, number>();
  intervals.forEach((interval) => {
    let bpm = 60 / interval;
    while (bpm < 80) bpm *= 2;
    while (bpm > 200) bpm /= 2;
    const rounded = Math.round(bpm * 2) / 2;
    bpmBuckets.set(rounded, (bpmBuckets.get(rounded) ?? 0) + 1);
  });
  let best = 0;
  let bestCount = 0;
  bpmBuckets.forEach((count, bpm) => {
    if (count > bestCount) {
      best = bpm;
      bestCount = count;
    }
  });
  return bestCount ? best : null;
}

export function estimateOffsetMs(peaks: Peak[], bpm: number) {
  if (!peaks.length) return 0;
  const beatDuration = 60 / bpm;
  const phases = peaks.map((peak) => peak.time % beatDuration);
  const phase = median(phases);
  return Math.round(phase * 1000);
}

export function generateNotesFromAudio(
  buffer: AudioBuffer,
  analysis: AudioAnalysis,
  options: AutoChartOptions
) {
  const { peaks, bpm } = analysis;
  if (!bpm || peaks.length === 0) return [] as Note[];

  const beatDuration = 60 / bpm;
  const safeDivisions = Math.max(options.snapDivisions, 4);
  const stepPerBeat = safeDivisions / 4;
  const minInterval = beatDuration / stepPerBeat;

  const filtered = filterPeaks(peaks, minInterval);
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = 1024;
  const offsetSeconds = analysis.offsetMs / 1000;
  const notesByBeat = new Map<
    number,
    { note: Note; ratio: number; energy: number; isBig: boolean }
  >();
  const ratios = filtered.map((peak) =>
    computeTransientRatio(channel, sampleRate, peak.time, windowSize)
  );
  const threshold = computeKatsuThreshold(ratios, options.katsuBias);
  const energyValues = filtered.map((peak) => peak.energy);
  const bigThreshold = computeBigThreshold(energyValues, options.katsuBias);

  filtered.forEach((peak, index) => {
    const beat = (peak.time - offsetSeconds) / beatDuration;
    if (beat < 0) return;
    const snapped = Math.round(beat * stepPerBeat) / stepPerBeat;
    const ratio = ratios[index] ?? 0;
    const baseType = ratio >= threshold ? "katsu" : "don";
    const isBig = peak.energy >= bigThreshold;
    const noteType = toSizedType(baseType, isBig);
    const entry = notesByBeat.get(snapped);
    if (!entry || peak.energy > entry.energy) {
      notesByBeat.set(snapped, {
        ratio,
        energy: peak.energy,
        isBig,
        note: {
          id: `${snapped.toFixed(3)}-${noteType}`,
          beat: snapped,
          type: noteType
        }
      });
    }
  });

  const entries = Array.from(notesByBeat.values());
  const katsuCount = entries.filter((entry) => isKatsu(entry.note.type)).length;
  if (entries.length >= 4) {
    if (katsuCount === 0) {
      const best = entries.reduce((max, entry) =>
        entry.ratio > max.ratio ? entry : max
      );
      const sized = toSizedType("katsu", best.isBig);
      best.note = {
        ...best.note,
        type: sized,
        id: `${best.note.beat.toFixed(3)}-${sized}`
      };
    } else if (katsuCount === entries.length) {
      const lowest = entries.reduce((min, entry) =>
        entry.ratio < min.ratio ? entry : min
      );
      const sized = toSizedType("don", lowest.isBig);
      lowest.note = {
        ...lowest.note,
        type: sized,
        id: `${lowest.note.beat.toFixed(3)}-${sized}`
      };
    }
  }

  const bigCount = entries.filter((entry) => isBigType(entry.note.type)).length;
  if (entries.length >= 8 && bigCount === 0) {
    const loudest = entries.reduce((max, entry) =>
      entry.energy > max.energy ? entry : max
    );
    const base = isKatsu(loudest.note.type) ? "katsu" : "don";
    const sized = toSizedType(base, true);
    loudest.note = {
      ...loudest.note,
      type: sized,
      id: `${loudest.note.beat.toFixed(3)}-${sized}`
    };
  }

  const hasBigDon = entries.some((entry) => entry.note.type === "don-big");
  const hasBigKatsu = entries.some((entry) => entry.note.type === "katsu-big");
  if (!hasBigDon) {
    const donCandidates = entries.filter((entry) => !isKatsu(entry.note.type));
    if (donCandidates.length) {
      const loudestDon = donCandidates.reduce((max, entry) =>
        entry.energy > max.energy ? entry : max
      );
      loudestDon.note = {
        ...loudestDon.note,
        type: "don-big",
        id: `${loudestDon.note.beat.toFixed(3)}-don-big`
      };
    }
  }
  if (!hasBigKatsu) {
    const katsuCandidates = entries.filter((entry) =>
      isKatsu(entry.note.type)
    );
    if (katsuCandidates.length) {
      const loudestKatsu = katsuCandidates.reduce((max, entry) =>
        entry.energy > max.energy ? entry : max
      );
      loudestKatsu.note = {
        ...loudestKatsu.note,
        type: "katsu-big",
        id: `${loudestKatsu.note.beat.toFixed(3)}-katsu-big`
      };
    }
  }

  return entries
    .map((entry) => entry.note)
    .sort((a, b) => a.beat - b.beat);
}

function filterPeaks(peaks: Peak[], minInterval: number) {
  const filtered: Peak[] = [];
  let lastPeak: Peak | null = null;
  peaks.forEach((peak) => {
    if (!lastPeak) {
      filtered.push(peak);
      lastPeak = peak;
      return;
    }
    if (peak.time - lastPeak.time >= minInterval) {
      filtered.push(peak);
      lastPeak = peak;
      return;
    }
    if (peak.energy > lastPeak.energy) {
      filtered[filtered.length - 1] = peak;
      lastPeak = peak;
    }
  });
  return filtered;
}

function computeTransientRatio(
  channel: Float32Array,
  sampleRate: number,
  time: number,
  windowSize: number,
): number {
  const center = Math.floor(time * sampleRate);
  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(channel.length, center + half);
  let energy = 0;
  let high = 0;
  for (let i = start + 1; i < end; i += 1) {
    const sample = channel[i];
    const prev = channel[i - 1];
    energy += Math.abs(sample);
    high += Math.abs(sample - prev);
  }
  return high / (energy + 1e-6);
}

function computeBigThreshold(values: number[], katsuBias: number) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const p85 = sorted[Math.floor(sorted.length * 0.85)] ?? sorted[0];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? p85;
  const bias = clamp(katsuBias, -0.6, 0.6) / 0.6;
  const blend = clamp(0.55 - bias * 0.1, 0.35, 0.75);
  return p85 + (p95 - p85) * blend;
}

function computeKatsuThreshold(values: number[], katsuBias: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const bias = clamp(katsuBias, -0.6, 0.6) / 0.6;
  const baseQuantile = 0.65;
  const quantile = clamp(baseQuantile - bias * 0.2, 0.35, 0.85);
  const index = Math.floor(quantile * (sorted.length - 1));
  return sorted[index] ?? sorted[0];
}

function smoothValues(values: number[], radius: number) {
  if (values.length === 0) return [];
  const window = Math.max(1, radius);
  const result: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - window; j <= i + window; j += 1) {
      if (j < 0 || j >= values.length) continue;
      sum += values[j];
      count += 1;
    }
    result.push(sum / Math.max(1, count));
  }
  return result;
}

function isKatsu(type: NoteType) {
  return type === "katsu" || type === "katsu-big";
}

function isBigType(type: NoteType) {
  return type === "don-big" || type === "katsu-big";
}

function toSizedType(base: "don" | "katsu", isBig: boolean): NoteType {
  if (!isBig) return base;
  return base === "don" ? "don-big" : "katsu-big";
}
