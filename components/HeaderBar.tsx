"use client";

import React from "react";
import { Download, Triangle } from "lucide-react";

type HeaderBarProps = {
  onPackage: () => void;
};

export function HeaderBar({ onPackage }: HeaderBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-white">
          <Triangle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink-900">TJA Studio</h1>
          <p className="text-xs text-ink-500">
            Apple HIG aligned chart editor for Taiko-style rhythm games
          </p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button className="button button-primary flex-1 sm:flex-none" onClick={onPackage}>
          <Download className="mr-2 inline h-4 w-4" />
          Package
        </button>
      </div>
    </div>
  );
}
