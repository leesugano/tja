"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Sliders } from "lucide-react";
import { HeaderBar } from "../components/HeaderBar";
import { LibrarySidebar } from "../components/LibrarySidebar";
import { CodeEditor } from "../components/CodeEditor";
import { NotesTimeline } from "../components/NotesTimeline";
import { PreviewCanvas } from "../components/PreviewCanvas";
import { MetadataPanel } from "../components/MetadataPanel";
import { AudioPanel } from "../components/AudioPanel";
import {
  buildNotesBlock,
  DEFAULT_TJA,
  parseTja,
  replaceNotesSection,
  updateHeaderValue,
  buildTjaFromMeta
} from "../lib/tja";
import type { Note, NoteType, TjaMetadata } from "../lib/tja";
import type { AudioAnalysis, AutoChartOptions } from "../lib/audio-analysis";
import { analyzeAudio, generateNotesFromAudio } from "../lib/audio-analysis";
import { HIT_WINDOWS_MS } from "../lib/tja";
import { useLocalStorage } from "../hooks/useLocalStorage";

const AUTO_DIFFICULTIES = ["Easy", "Normal", "Hard", "Oni"] as const;
type AutoDifficulty = (typeof AUTO_DIFFICULTIES)[number];

type ChartEntry = {
  id: string;
  name: string;
  updatedAt: string;
  tjaText: string;
};

type AutoVariant = {
  course: string;
  level: number;
  balloon: number[];
  notes: Note[];
  tjaText: string;
};

type JudgeResult = "Perfect" | "Good" | "Ok" | "Miss" | "";

const COURSE_ORDER = ["Easy", "Normal", "Hard", "Oni", "Ura"] as const;

type CourseBlock = {
  course: string;
  level: number;
  balloon: number[];
  notesBlock: string;
  headerLines: string[];
  isActive: boolean;
};

const normalizeTitle = (value: string) => value.trim();

const extractCourseHeaderLines = (source: string) => {
  const lines = source.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith("#START")
  );
  const headerLines = startIndex === -1 ? lines : lines.slice(0, startIndex);
  return headerLines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const upper = trimmed.toUpperCase();
    if (upper.startsWith("TITLE:")) return false;
    if (upper.startsWith("BPM:")) return false;
    if (upper.startsWith("OFFSET:")) return false;
    if (upper.startsWith("WAVE:")) return false;
    return true;
  });
};

const extractNotesBlock = (source: string) => {
  const lines = source.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith("#START")
  );
  const endIndex = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith("#END")
  );
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return "";
  }
  return lines.slice(startIndex + 1, endIndex).join("\n").trim();
};

const extractGlobalHeaderLines = (source: string) => {
  const lines = source.split(/\r?\n/);
  const stopIndex = lines.findIndex((line) => {
    const trimmed = line.trim().toUpperCase();
    return trimmed.startsWith("COURSE:") || trimmed.startsWith("#START");
  });
  const headerLines = stopIndex === -1 ? lines : lines.slice(0, stopIndex);
  return headerLines.filter((line) => line.trim() !== "");
};

const upsertHeaderLine = (lines: string[], key: string, value: string) => {
  const index = lines.findIndex((line) =>
    line.trim().toUpperCase().startsWith(`${key.toUpperCase()}:`)
  );
  const nextLine = `${key.toUpperCase()}:${value}`;
  if (index >= 0) {
    lines[index] = nextLine;
    return lines;
  }
  return [...lines, nextLine];
};

const buildCombinedTja = (
  base: { title: string; bpm: number; offset: number; wave: string },
  blocks: CourseBlock[],
  baseHeaderLines: string[]
) => {
  let headerLines = [...baseHeaderLines];
  headerLines = upsertHeaderLine(headerLines, "TITLE", base.title);
  headerLines = upsertHeaderLine(headerLines, "BPM", base.bpm.toString());
  headerLines = upsertHeaderLine(headerLines, "OFFSET", base.offset.toString());
  headerLines = upsertHeaderLine(headerLines, "WAVE", base.wave);

  const blockSections = blocks.map((block) => {
    const header = [...block.headerLines];
    const hasCourse = header.some((line) =>
      line.trim().toUpperCase().startsWith("COURSE:")
    );
    const hasLevel = header.some((line) =>
      line.trim().toUpperCase().startsWith("LEVEL:")
    );
    const hasBalloon = header.some((line) =>
      line.trim().toUpperCase().startsWith("BALLOON:")
    );

    const required: string[] = [];
    if (!hasCourse) required.push(`COURSE:${block.course}`);
    if (!hasLevel) required.push(`LEVEL:${block.level}`);
    if (!hasBalloon) {
      required.push(`BALLOON:${block.balloon.length ? block.balloon.join(",") : ""}`);
    }

    const headerLines = [...required, ...header];
    const notesBlock = block.notesBlock || "0,";

    return `${headerLines.join("\n")}\n\n#START\n${notesBlock}\n#END`;
  });

  return `${headerLines.join("\n")}\n\n${blockSections.join("\n\n")}\n`;
};

const ensureBigNotes = (notes: Note[]) => {
  const next = notes.map((note) => ({ ...note }));
  const hasDon = next.some(
    (note) => note.type === "don" || note.type === "don-big"
  );
  const hasKatsu = next.some(
    (note) => note.type === "katsu" || note.type === "katsu-big"
  );
  if (!hasDon && next.length) {
    next[0].type = "don";
    next[0].id = `${next[0].beat.toFixed(3)}-don`;
  }
  if (!hasKatsu && next.length) {
    const target = next.find((note) => note.type !== "don") ?? next[0];
    target.type = "katsu";
    target.id = `${target.beat.toFixed(3)}-katsu`;
  }

  const hasBigDon = next.some((note) => note.type === "don-big");
  const hasBigKatsu = next.some((note) => note.type === "katsu-big");
  if (hasBigDon && hasBigKatsu) return next;
  if (!hasBigDon) {
    const target = next.find((note) => note.type === "don");
    if (target) {
      target.type = "don-big";
      target.id = `${target.beat.toFixed(3)}-don-big`;
    }
  }
  if (!hasBigKatsu) {
    const target = next.find((note) => note.type === "katsu");
    if (target) {
      target.type = "katsu-big";
      target.id = `${target.beat.toFixed(3)}-katsu-big`;
    }
  }
  return next;
};

export default function Home() {
  const [tjaText, setTjaText] = useState(DEFAULT_TJA);
  const parsed = useMemo(() => parseTja(tjaText), [tjaText]);
  const [notes, setNotes] = useState<Note[]>(parsed.notes);
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>("don");
  const [snapDivisions, setSnapDivisions] = useState(16);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const useGemini = false;
  const [autoOptions, setAutoOptions] = useState<AutoChartOptions>({
    snapDivisions: 16,
    sensitivity: 0.6,
    katsuBias: 0
  });
  const [autoDifficulty, setAutoDifficulty] = useState<AutoDifficulty>("Oni");
  const [autoVariants, setAutoVariants] = useState<AutoVariant[]>([]);
  const [previewDifficulty, setPreviewDifficulty] = useState<string>("Oni");
  const [generationState, setGenerationState] = useState<
    "idle" | "working" | "done"
  >("idle");
  const [autoError, setAutoError] = useState<string | null>(null);
  const [charts, setCharts, chartsHydrated] = useLocalStorage<ChartEntry[]>(
    "tja-charts",
    [
      {
        id: "default",
        name: "New Taiko Chart",
        updatedAt: "Just now",
        tjaText: DEFAULT_TJA
      }
    ]
  );
  const [activeChartId, setActiveChartId] = useState("default");
  const [downloadState, setDownloadState] = useState<
    "idle" | "working" | "error"
  >("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const syncedChartIdRef = useRef<string | null>(null);
  const skipNextChartWriteRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [judgeState, setJudgeState] = useState({
    judge: "" as JudgeResult,
    latency: null as number | null,
    combo: 0
  });

  useEffect(() => {
    setNotes(parsed.notes);
  }, [parsed.notes]);

  useEffect(() => {
    if (!autoVariants.length) return;
    setAutoVariants((prev) => {
      let changed = false;
      const next = prev.map((variant) => {
        if (variant.course !== parsed.meta.course) return variant;
        if (
          variant.tjaText === tjaText &&
          variant.level === parsed.meta.level &&
          variant.balloon.join(",") === parsed.meta.balloon.join(",")
        ) {
          return variant;
        }
        changed = true;
        return {
          ...variant,
          level: parsed.meta.level,
          balloon: parsed.meta.balloon,
          notes,
          tjaText
        };
      });
      return changed ? next : prev;
    });
  }, [
    autoVariants.length,
    notes,
    parsed.meta.balloon.join(","),
    parsed.meta.course,
    parsed.meta.level,
    tjaText
  ]);

  useEffect(() => {
    if (autoVariants.length) {
      setPreviewDifficulty((current) =>
        autoVariants.some((variant) => variant.course === current)
          ? current
          : autoVariants[0].course
      );
      return;
    }
    setPreviewDifficulty(parsed.meta.course);
  }, [autoVariants, parsed.meta.course]);

  useEffect(() => {
    if (!chartsHydrated) return;
    if (syncedChartIdRef.current === activeChartId) return;
    const chart = charts.find((entry) => entry.id === activeChartId);
    if (!chart) return;
    syncedChartIdRef.current = activeChartId;
    setAutoVariants([]);
    if (!chart.tjaText) {
      skipNextChartWriteRef.current = true;
      setTjaText(DEFAULT_TJA);
      setCharts((prev) =>
        prev.map((entry) =>
          entry.id === activeChartId ? { ...entry, tjaText: DEFAULT_TJA } : entry
        )
      );
      return;
    }
    skipNextChartWriteRef.current = true;
    setTjaText(chart.tjaText);
  }, [activeChartId, charts, chartsHydrated, setCharts]);

  useEffect(() => {
    if (!chartsHydrated) return;
    if (skipNextChartWriteRef.current) {
      skipNextChartWriteRef.current = false;
      return;
    }
    setCharts((prev) =>
      prev.map((entry) =>
        entry.id === activeChartId
          ? {
              ...entry,
              name: parsed.meta.title,
              tjaText,
              updatedAt: new Date().toISOString()
            }
          : entry
      )
    );
  }, [activeChartId, chartsHydrated, parsed.meta.title, setCharts, tjaText]);

  useEffect(() => {
    if (!audioBuffer) return;
    const nextAnalysis = analyzeAudio(audioBuffer, autoOptions.sensitivity);
    setAnalysis(nextAnalysis);
  }, [audioBuffer, autoOptions.sensitivity]);

  const handleNoteToggle = (beat: number) => {
    setNotes((prev) => {
      const existing = prev.find((note) => Math.abs(note.beat - beat) < 0.01);
      let nextNotes: Note[] = [];
      if (existing) {
        if (existing.type === selectedNoteType) {
          nextNotes = prev.filter((note) => note.id !== existing.id);
        } else {
          nextNotes = prev.map((note) =>
            note.id === existing.id ? { ...note, type: selectedNoteType } : note
          );
        }
      } else {
        nextNotes = [
          ...prev,
          { id: `${beat}-${selectedNoteType}`, beat, type: selectedNoteType }
        ];
      }
      const notesBlock = buildNotesBlock(nextNotes, snapDivisions);
      setTjaText((current) => replaceNotesSection(current, notesBlock));
      return nextNotes;
    });
  };

  const updateMeta = (key: keyof TjaMetadata, value: string) => {
    setTjaText((current) => updateHeaderValue(current, key.toString(), value));
  };

  const handleAudioUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    setAudioBuffer(buffer);
    setAudioName(file.name);
    audioFileRef.current = file;
    updateMeta("wave", file.name);
    if (audioRef.current) {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      audioUrlRef.current = objectUrl;
      audioRef.current.src = objectUrl;
    }
  };

  const handleDownload = async () => {
    setDownloadState("working");
    setDownloadError(null);
    const rawTitle = parsed.meta.title?.trim() || "Chart";
    const safeTitle = rawTitle.replace(/[\\/]/g, "-").trim() || "Chart";
    const audioFile = audioFileRef.current;
    const audioExtMatch = audioFile?.name.match(/\.[^./\\]+$/);
    const audioExt = audioExtMatch?.[0] ?? ".ogg";
    const audioTargetName = audioFile ? `${safeTitle}${audioExt}` : "";
    const titleKey = normalizeTitle(rawTitle);
    const courseEntriesFromCharts = charts
      .map((entry) => {
        const parsedEntry = parseTja(entry.tjaText);
        return {
          id: entry.id,
          meta: parsedEntry.meta,
          tjaText: entry.tjaText,
          isActive: entry.id === activeChartId
        };
      })
      .filter((entry) => normalizeTitle(entry.meta.title) === titleKey)
      .map((entry) => ({
        course: entry.meta.course,
        level: entry.meta.level,
        balloon: entry.meta.balloon,
        notesBlock: extractNotesBlock(entry.tjaText),
        headerLines: extractCourseHeaderLines(entry.tjaText),
        isActive: entry.isActive
      }));

    const courseEntries = (autoVariants.length
      ? autoVariants
      : courseEntriesFromCharts
    ).map((entry) => {
      if ("notes" in entry) {
        return {
          course: entry.course,
          level: entry.level,
          balloon: entry.balloon,
          notesBlock: extractNotesBlock(entry.tjaText),
          headerLines: extractCourseHeaderLines(entry.tjaText),
          isActive: entry.course === parsed.meta.course
        };
      }
      return entry;
    });

    const uniqueCourses = new Map<string, CourseBlock>();
    courseEntries.forEach((entry) => {
      if (!uniqueCourses.has(entry.course) || entry.isActive) {
        uniqueCourses.set(entry.course, entry);
      }
    });

    const sortedCourses = Array.from(uniqueCourses.values()).sort((a, b) => {
      const indexA = COURSE_ORDER.indexOf(a.course as (typeof COURSE_ORDER)[number]);
      const indexB = COURSE_ORDER.indexOf(b.course as (typeof COURSE_ORDER)[number]);
      const safeA = indexA === -1 ? COURSE_ORDER.length : indexA;
      const safeB = indexB === -1 ? COURSE_ORDER.length : indexB;
      return safeA - safeB;
    });

    const headerLines = extractGlobalHeaderLines(tjaText);
    const base = {
      title: rawTitle,
      bpm: parsed.meta.bpm,
      offset: parsed.meta.offset,
      wave: audioTargetName || parsed.meta.wave
    };

    const nextTjaText =
      sortedCourses.length > 1
        ? buildCombinedTja(base, sortedCourses, headerLines)
        : audioTargetName
          ? updateHeaderValue(tjaText, "wave", audioTargetName)
          : tjaText;

    const formData = new FormData();
    formData.append("title", safeTitle);
    formData.append("tja", nextTjaText);
    if (audioFile) {
      formData.append("audio", audioFile);
    }

    try {
      const response = await fetch("/api/build", {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Download failed");
      }
      const blob = await response.blob();
      const downloadName = `${safeTitle}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloadState("idle");
    } catch (error) {
      setDownloadState("error");
      setDownloadError(
        error instanceof Error ? error.message : "Failed to download files."
      );
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleJudge = useCallback((result: {
    judge: JudgeResult;
    latency: number | null;
    combo: number;
  }) => {
    setJudgeState(result);
  }, []);

  const handleAutoGenerate = async () => {
    if (!audioBuffer) return;
    setGenerationState("working");
    setAutoError(null);
    let baseNotes: Note[] = [];
    let nextAnalysis: AudioAnalysis | null = null;

    if (useGemini && audioFileRef.current) {
      try {
        const formData = new FormData();
        formData.append("file", audioFileRef.current);
        const response = await fetch("/api/gemini", {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Gemini failed");
        }
        const bpm = Number(data.bpm);
        const offsetMs = Number(data.offsetMs);
        const events: Array<{ timeSec: number; type: "don" | "katsu" }> =
          Array.isArray(data.events) ? data.events : [];
        nextAnalysis = {
          bpm: Number.isFinite(bpm) ? bpm : null,
          offsetMs: Number.isFinite(offsetMs) ? offsetMs : 0,
          peaks: []
        };
        baseNotes = events
          .map((event: { timeSec: number; type: "don" | "katsu" }) => {
            const timeSec = Number(event.timeSec);
            if (!Number.isFinite(timeSec) || !nextAnalysis?.bpm) return null;
            const beat = (timeSec - nextAnalysis.offsetMs / 1000) /
              (60 / nextAnalysis.bpm);
            return {
              id: `${beat.toFixed(3)}-${event.type}`,
              beat,
              type: event.type === "katsu" ? "katsu" : "don"
            } as Note;
          })
          .filter((note): note is Note => Boolean(note && note.beat >= 0));
      } catch (error) {
        baseNotes = [];
        nextAnalysis = null;
        setAutoError(
          error instanceof Error
            ? error.message
            : "Gemini failed, falling back to local analysis."
        );
      }
    }

    if (!nextAnalysis) {
      nextAnalysis = analyzeAudio(audioBuffer, autoOptions.sensitivity);
      baseNotes = generateNotesFromAudio(audioBuffer, nextAnalysis, autoOptions);
    }
    baseNotes = ensureBigNotes(baseNotes);

    setAnalysis(nextAnalysis);
    if (nextAnalysis.bpm) {
      updateMeta("bpm", nextAnalysis.bpm.toString());
    }
    updateMeta("offset", nextAnalysis.offsetMs.toString());

    const difficultyConfigs = [
      { course: "Easy", level: Math.max(2, parsed.meta.level - 4), density: 0.35 },
      { course: "Normal", level: Math.max(3, parsed.meta.level - 2), density: 0.55 },
      { course: "Hard", level: Math.max(5, parsed.meta.level - 1), density: 0.75 },
      { course: "Oni", level: Math.max(7, parsed.meta.level), density: 1 }
    ];

    const buildVariantNotes = (density: number) => {
      if (density >= 0.95) return baseNotes;
      const step = Math.max(1, Math.round(1 / density));
      if (step === 1) {
        return baseNotes.filter((_, index) => index % 4 !== 3);
      }
      return baseNotes.filter((_, index) => index % step === 0);
    };

    const variants = difficultyConfigs.map((config) => {
      const variantNotes = ensureBigNotes(buildVariantNotes(config.density));
      const meta: TjaMetadata = {
        ...parsed.meta,
        bpm: nextAnalysis?.bpm ?? parsed.meta.bpm,
        offset: nextAnalysis?.offsetMs ?? parsed.meta.offset,
        course: config.course,
        level: config.level
      };
      return {
        course: config.course,
        level: config.level,
        balloon: meta.balloon,
        notes: variantNotes,
        tjaText: buildTjaFromMeta(meta, variantNotes, autoOptions.snapDivisions)
      };
    });

    const selectedVariant =
      variants.find((variant) => variant.course === autoDifficulty) ??
      variants.find((variant) => variant.course === "Oni") ??
      variants[0];
    if (selectedVariant) {
      setNotes(selectedVariant.notes);
      setSnapDivisions(autoOptions.snapDivisions);
      setTjaText(selectedVariant.tjaText);
      setPreviewDifficulty(selectedVariant.course);
    }

    setAutoVariants(variants);

    setGenerationState("done");
  };

  const previewCourses = autoVariants.length
    ? Array.from(new Set(autoVariants.map((variant) => variant.course))).sort(
        (a, b) => {
          const indexA = COURSE_ORDER.indexOf(
            a as (typeof COURSE_ORDER)[number]
          );
          const indexB = COURSE_ORDER.indexOf(
            b as (typeof COURSE_ORDER)[number]
          );
          const safeA = indexA === -1 ? COURSE_ORDER.length : indexA;
          const safeB = indexB === -1 ? COURSE_ORDER.length : indexB;
          return safeA - safeB;
        }
      )
    : [parsed.meta.course];
  const previewVariant = autoVariants.find(
    (variant) => variant.course === previewDifficulty
  );
  const previewNotes = previewVariant?.notes ?? notes;

  return (
    <div className="app-shell">
      <HeaderBar
        onDownload={handleDownload}
        downloadState={downloadState}
        downloadError={downloadError}
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_300px]">
        <LibrarySidebar
          charts={charts}
          activeChartId={activeChartId}
          onSelect={setActiveChartId}
          onAdd={() => {
            const id = crypto.randomUUID();
            setCharts((prev) => [
              {
                id,
                name: "Untitled Chart",
                updatedAt: new Date().toISOString(),
                tjaText: DEFAULT_TJA
              },
              ...prev
            ]);
            setActiveChartId(id);
          }}
          onDuplicate={(id) =>
            setCharts((prev) => {
              const entry = prev.find((item) => item.id === id);
              if (!entry) return prev;
              const copy = {
                ...entry,
                id: crypto.randomUUID(),
                name: `${entry.name} Copy`,
                updatedAt: new Date().toISOString()
              };
              return [copy, ...prev];
            })
          }
          onRemove={(id) =>
            setCharts((prev) => {
              const next = prev.filter((entry) => entry.id !== id);
              if (id === activeChartId && next[0]) {
                setActiveChartId(next[0].id);
              }
              return next;
            })
          }
          latency={judgeState.latency}
          judge={judgeState.judge}
        />

        <main className="flex flex-col gap-4">
          <CodeEditor
            value={tjaText}
            onChange={setTjaText}
            errorsCount={parsed.errors.length}
            warningsCount={parsed.warnings.length}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <AudioPanel
              audioBuffer={audioBuffer}
              audioName={audioName}
              onUpload={handleAudioUpload}
              analysis={analysis}
              bpm={parsed.meta.bpm}
              offset={parsed.meta.offset}
              autoOptions={autoOptions}
              onAutoOptionsChange={setAutoOptions}
              autoDifficulty={autoDifficulty}
              onAutoDifficultyChange={setAutoDifficulty}
              onGenerate={handleAutoGenerate}
              generationState={generationState}
              autoError={autoError}
            />

            <div className="panel rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink-800">
                    Visual Note Editor
                  </h3>
                  <p className="text-xs text-ink-500">
                    Place Don/Katsu notes with measure snapping and live TJA sync
                  </p>
                </div>
                <div className="segmented">
                  {[
                    { label: "Don", value: "don" },
                    { label: "Katsu", value: "katsu" },
                    { label: "Big Don", value: "don-big" },
                    { label: "Big Katsu", value: "katsu-big" }
                  ].map((note) => (
                    <button
                      key={note.value}
                      data-active={selectedNoteType === note.value}
                      onClick={() => setSelectedNoteType(note.value as NoteType)}
                    >
                      {note.label}
                    </button>
                  ))}
                </div>
              </div>
              <NotesTimeline
                notes={notes}
                onToggleNote={handleNoteToggle}
                noteType={selectedNoteType}
                bpm={parsed.meta.bpm}
                offset={parsed.meta.offset}
                snapDivisions={snapDivisions}
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Sliders className="h-4 w-4" />
                  Snap divisions
                </div>
                <select
                  className="input"
                  value={snapDivisions}
                  onChange={(event) => setSnapDivisions(Number(event.target.value))}
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                  <option value={32}>32</option>
                </select>
              </div>
            </div>
          </section>

          <section className="panel rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-800">
                  Realtime Preview
                </h3>
                <p className="text-xs text-ink-500">
                  Scroll sync, hit windows, accuracy judge, combo, and latency
                  feedback
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-ink-500">
                  <span>Difficulty</span>
                  <select
                    className="input input-compact"
                    value={previewDifficulty}
                    onChange={(event) => setPreviewDifficulty(event.target.value)}
                  >
                    {previewCourses.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-muted" onClick={togglePlayback}>
                  {isPlaying ? (
                    <Pause className="mr-2 inline h-4 w-4" />
                  ) : (
                    <Play className="mr-2 inline h-4 w-4" />
                  )}
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <span className="badge">Combo {judgeState.combo}</span>
                <span className="badge">{judgeState.judge || "Ready"}</span>
              </div>
            </div>
            <PreviewCanvas
              notes={previewNotes}
              bpm={parsed.meta.bpm}
              offset={parsed.meta.offset}
              audioRef={audioRef}
              isPlaying={isPlaying}
              onJudge={handleJudge}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-500">
              <span>
                Keys: <span className="kbd">F</span> <span className="kbd">J</span>{" "}
                or <span className="kbd">D</span> <span className="kbd">K</span>
              </span>
              <span className="badge">
                Hit windows: {HIT_WINDOWS_MS.Perfect}/{HIT_WINDOWS_MS.Good}/
                {HIT_WINDOWS_MS.Ok} ms
              </span>
              <span className="badge">Preview updates on code edits</span>
            </div>
          </section>
          <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
        </main>

        <aside className="flex flex-col gap-4">
          <MetadataPanel
            meta={parsed.meta}
            onUpdate={updateMeta}
          />
        </aside>
      </div>
      <footer className="mt-6 text-center text-xs text-ink-500">
        Desenvolvido com carinho por{" "}
        <a
          href="https://leesugano.com"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-ink-700 hover:text-tide-500"
        >
          Lee Sugano
        </a>
      </footer>
    </div>
  );
}
