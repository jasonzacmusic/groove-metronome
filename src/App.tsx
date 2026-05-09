import { useEffect, useState } from "react";

import { useMetronome } from "@/hooks/useMetronome";
import { AnalyzerPage } from "@/pages/AnalyzerPage";
import { MetronomePage } from "@/pages/MetronomePage";

type Tab = "metronome" | "analyzer";
export type MetronomeView = "beatmap" | "levels" | "polyrhythm";
type ThemeId = "midnight" | "concert" | "aqua" | "graphite" | "contrast";

const THEME_STORAGE_KEY = "groove-metronome.theme.v1";
const THEMES: Array<{ id: ThemeId; label: string; colors: [string, string, string] }> = [
  { id: "midnight", label: "Midnight", colors: ["#101525", "#facc15", "#4deee0"] },
  { id: "concert", label: "Concert", colors: ["#120b1f", "#ff4f8b", "#45d483"] },
  { id: "aqua", label: "Aqua", colors: ["#062326", "#62f4c8", "#ffd166"] },
  { id: "graphite", label: "Graphite", colors: ["#111315", "#d9e2ec", "#f5b642"] },
  { id: "contrast", label: "Contrast", colors: ["#020617", "#ffffff", "#39ff14"] },
];

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "midnight";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.some((theme) => theme.id === stored) ? (stored as ThemeId) : "midnight";
}

export default function App() {
  const metronome = useMetronome();
  const [tab, setTab] = useState<Tab>("metronome");
  const [view, setView] = useState<MetronomeView>("beatmap");
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div data-theme={theme} className="relative min-h-full bg-background text-foreground overflow-x-hidden">
      {/* Background layers */}
      <div className="warm-glow" aria-hidden />
      <div className="film-grain" aria-hidden />

      {/* Slim masthead */}
      <header className="relative z-10 border-b border-border/70">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/brand/nsm-white.png"
              alt="Nathaniel School of Music"
              className="h-9 w-auto shrink-0 object-contain md:h-11"
            />
            <div className="min-w-0 border-l border-border/70 pl-3">
              <h1 className="font-serif text-xl md:text-2xl leading-none tracking-tight text-foreground">
                Groove Metronome
              </h1>
              <p className="mt-1 tiny-caps text-[9px] text-muted-foreground/75 truncate">
                See it. Count it. Lock it in.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
            <nav className="flex w-full items-center justify-between gap-4 tiny-caps text-[11px] sm:w-auto sm:justify-start sm:gap-5 sm:text-xs">
              <button
                type="button"
                onClick={() => setTab("metronome")}
                className={tab === "metronome" ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}
              >
                Metronome
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={() => setTab("analyzer")}
                className={tab === "analyzer" ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}
              >
                Analyzer
              </button>
              {metronome.state.isPlaying && (
                <span className="ml-1 tiny-caps text-[10px] text-primary tabular flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {Math.round(metronome.state.bpm)}
                </span>
              )}
            </nav>
            <ThemeSwitch theme={theme} onThemeChange={setTheme} />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5 md:px-10 py-6 md:py-10">
        {tab === "metronome" ? (
          <MetronomePage metronome={metronome} view={view} onViewChange={setView} />
        ) : (
          <AnalyzerPage
            onUseAsBpm={(bpm) => {
              metronome.setBpm(bpm);
              setTab("metronome");
            }}
            onUseAsTimeSignature={(numerator, denominator) => {
              metronome.setTimeSignature({ numerator, denominator });
              setTab("metronome");
            }}
          />
        )}
      </main>
    </div>
  );
}

function ThemeSwitch({ theme, onThemeChange }: { theme: ThemeId; onThemeChange: (theme: ThemeId) => void }) {
  return (
    <div className="flex flex-col gap-1.5 sm:items-end" aria-label="Color theme">
      <span className="tiny-caps text-[9px] text-muted-foreground/75">Theme</span>
      <div className="grid grid-cols-5 gap-1.5 sm:flex sm:items-center">
        {THEMES.map((option) => {
          const active = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onThemeChange(option.id)}
              className="theme-swatch"
              aria-label={`${option.label} theme`}
              aria-pressed={active}
              title={option.label}
              style={{
                outlineColor: active ? "hsl(var(--primary))" : "transparent",
              }}
            >
              <span
                className="theme-swatch-palette"
                style={{ background: `linear-gradient(135deg, ${option.colors[0]} 0 38%, ${option.colors[1]} 38% 69%, ${option.colors[2]} 69% 100%)` }}
              />
              <span className="theme-swatch-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
