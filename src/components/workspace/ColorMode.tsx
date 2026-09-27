"use client";

import { useEffect, useState } from "react";

export type ColorMode = "light" | "dark" | "system";

export function applyColorMode(mode: ColorMode) {
  try {
    localStorage.setItem("cb-color-mode", mode);
  } catch {
    /* ignore */
  }
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useColorMode(): [ColorMode, (m: ColorMode) => void] {
  const [mode, setMode] = useState<ColorMode>("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cb-color-mode") as ColorMode | null;
      if (saved === "dark" || saved === "light" || saved === "system") setMode(saved);
    } catch {
      /* ignore */
    }
  }, []);
  return [
    mode,
    (m) => {
      setMode(m);
      applyColorMode(m);
    },
  ];
}
