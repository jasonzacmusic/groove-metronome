import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";

import { useMetronome } from "@/hooks/useMetronome";
import { AnalyzerPage } from "@/pages/AnalyzerPage";
import { MetronomePage } from "@/pages/MetronomePage";
import { SetlistPage } from "@/pages/SetlistPage";
import { buildDefaultPattern, type MeterDenominator, type TimeSignature } from "@/lib/metronome-types";

type Tab = "metronome" | "analyzer" | "setlist";
export type MetronomeView = "beatmap" | "levels" | "polyrhythm" | "polymeter";
type ThemeId = "midnight" | "concert" | "aqua" | "graphite" | "contrast";

const THEME_STORAGE_KEY = "groove-metronome.theme.v1";
const PUBLIC_URL = "https://metronome.nathanielschool.com/";
const SHARE_TITLE = "Groove Metronome";
const SHARE_TEXT = "Groove Metronome is a serious online metronome for musicians: beat maps, polyrhythm, polymeter, practice tools, and audio/MIDI analysis.";
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
  const [analyzerStartDelay, setAnalyzerStartDelay] = useState(0);

  const prepareAnalyzerClick = (timeSignature: TimeSignature = metronome.state.timeSignature) => {
    const denominator: MeterDenominator = timeSignature.denominator === 16 ? 16 : timeSignature.denominator === 8 ? 8 : 4;
    metronome.setPattern(buildDefaultPattern(timeSignature.numerator, 1));
    metronome.setSwing(0);
    metronome.setTrainerEnabled(false);
    metronome.setRampEnabled(false);
    metronome.setPolyrhythm({
      enabled: false,
      dottedMode: "off",
      tripletMode: "off",
      rate: "double",
      polymeterEnabled: false,
      polymeterLanes: [{ numerator: timeSignature.numerator, denominator }],
    });
    setView("beatmap");
  };

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLInputElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editable || event.code !== "Space") return;
      event.preventDefault();
      if (tab === "analyzer") {
        prepareAnalyzerClick();
        if (metronome.state.isPlaying) metronome.stop();
        else void metronome.start({ delaySeconds: analyzerStartDelay });
        return;
      }
      metronome.toggle();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [analyzerStartDelay, metronome, tab]);

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
                onClick={() => {
                  prepareAnalyzerClick();
                  setTab("analyzer");
                }}
                className={tab === "analyzer" ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}
              >
                Analyzer
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={() => setTab("setlist")}
                className={tab === "setlist" ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}
              >
                Setlist Studio
              </button>
              {metronome.state.isPlaying && (
                <span className="ml-1 tiny-caps text-[10px] text-primary tabular flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {Math.round(metronome.state.bpm)}
                </span>
              )}
            </nav>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <ShareStrip />
              <ThemeSwitch theme={theme} onThemeChange={setTheme} />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5 md:px-10 py-6 md:py-10">
        <div hidden={tab !== "metronome"}>
          <MetronomePage metronome={metronome} view={view} onViewChange={setView} active={tab === "metronome"} />
        </div>
        <div hidden={tab !== "analyzer"}>
          <AnalyzerPage
            metronome={metronome}
            active={tab === "analyzer"}
            analyzerStartDelay={analyzerStartDelay}
            onAnalyzerStartDelayChange={setAnalyzerStartDelay}
            onPrepareAnalyzerClick={prepareAnalyzerClick}
            onUseAsBpm={(bpm) => {
              prepareAnalyzerClick();
              metronome.setBpm(bpm);
            }}
            onUseAsTimeSignature={(numerator, denominator) => {
              const next = { numerator, denominator } as TimeSignature;
              metronome.setTimeSignature(next);
              prepareAnalyzerClick(next);
            }}
          />
        </div>
        <div hidden={tab !== "setlist"}>
          <SetlistPage metronome={metronome} active={tab === "setlist"} />
        </div>
      </main>
      <SeoFooter />
    </div>
  );
}

function ShareStrip() {
  const [copied, setCopied] = useState<"link" | "caption" | null>(null);

  const markCopied = (kind: "link" | "caption") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : PUBLIC_URL;
    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
        return;
      } catch {
        // Fall back to copy when the native share sheet is dismissed or unavailable.
      }
    }
    await navigator.clipboard?.writeText(`${SHARE_TEXT} ${url}`);
    markCopied("caption");
  };

  const copyLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : PUBLIC_URL;
    await navigator.clipboard?.writeText(url);
    markCopied("link");
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${PUBLIC_URL}`)}`;

  return (
    <div className="flex flex-col gap-1.5 sm:items-end" aria-label="Share Groove Metronome">
      <span className="tiny-caps text-[9px] text-muted-foreground/75">Share</span>
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" onClick={share} className="share-action" title="Share">
          <Share2 className="size-4" aria-hidden />
          <span className="sr-only">Share</span>
        </button>
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="share-action" title="Share on WhatsApp">
          <MessageCircle className="size-4" aria-hidden />
          <span className="sr-only">WhatsApp</span>
        </a>
        <button type="button" onClick={copyLink} className="share-action" title={copied === "link" ? "Copied" : "Copy link"}>
          {copied === "link" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          <span className="sr-only">Copy link</span>
        </button>
      </div>
    </div>
  );
}

function SeoFooter() {
  return (
    <footer className="relative z-10 mx-auto max-w-6xl px-5 pb-8 text-xs leading-relaxed text-muted-foreground md:px-10">
      <p>
        Groove Metronome is a free online metronome for musicians, teachers, bands, and students who need a precise click with beat maps,
        subdivisions, accents, polyrhythm, polymeter, practice ramps, mute training, setlists, audio tempo detection, and MIDI analysis.
      </p>
    </footer>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
