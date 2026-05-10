import { Suspense, lazy, useEffect, useState } from "react";
import { AudioWaveform, Check, Copy, Gauge, ListMusic, MessageCircle, Share2 } from "lucide-react";

import { useMetronome } from "@/hooks/useMetronome";
import { MetronomePage } from "@/pages/MetronomePage";
import { LandingPage } from "@/pages/LandingPage";
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
  { id: "concert", label: "Pulse Green", colors: ["#071b14", "#48e48a", "#f4729b"] },
  { id: "aqua", label: "Aqua", colors: ["#062326", "#62f4c8", "#ffd166"] },
  { id: "graphite", label: "Vintage Graphite", colors: ["#e6dbc4", "#4f382b", "#ad5f30"] },
  { id: "contrast", label: "Contrast", colors: ["#020617", "#ffffff", "#39ff14"] },
];

const APP_TABS: Array<{
  id: Tab;
  label: string;
  shortLabel: string;
  detail: string;
  icon: typeof Gauge;
}> = [
  { id: "metronome", label: "Metronome", shortLabel: "Click", detail: "Practice click", icon: Gauge },
  { id: "analyzer", label: "Analyzer", shortLabel: "Analyze", detail: "Audio & MIDI", icon: AudioWaveform },
  { id: "setlist", label: "Setlist Studio", shortLabel: "Setlist", detail: "Concert mode", icon: ListMusic },
];

const AnalyzerPage = lazy(() => import("@/pages/AnalyzerPage").then((module) => ({ default: module.AnalyzerPage })));
const SetlistPage = lazy(() => import("@/pages/SetlistPage").then((module) => ({ default: module.SetlistPage })));

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "graphite";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.some((theme) => theme.id === stored) ? (stored as ThemeId) : "graphite";
}

function readInitialTab(): Tab {
  if (typeof window === "undefined") return "metronome";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("tab");
  if (requested === "analyzer" || requested === "setlist" || requested === "metronome") return requested;
  if (params.has("setlist")) return "setlist";
  return "metronome";
}

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/landing") {
    return <LandingPage />;
  }

  const metronome = useMetronome();
  const [tab, setTab] = useState<Tab>(readInitialTab);
  const [view, setView] = useState<MetronomeView>("beatmap");
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);
  const [analyzerStartDelay, setAnalyzerStartDelay] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState(() => {
    const initialTab = readInitialTab();
    return { analyzer: initialTab === "analyzer", setlist: initialTab === "setlist" };
  });

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
      jazzMode: "off",
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
      if (event.repeat) return;
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
    <div data-theme={theme} className="app-shell relative min-h-full bg-background text-foreground overflow-x-hidden">
      {/* Background layers */}
      <div className="warm-glow" aria-hidden />
      <div className="film-grain" aria-hidden />

      {/* Compact app masthead */}
      <header className="mobile-masthead relative z-10 border-b border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 md:px-10 md:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(380px,1fr)_minmax(500px,1.38fr)_auto] xl:items-center">
            <div className="brand-lockup flex min-w-0 items-center gap-3 xl:min-w-[380px]">
              <img
                src="/brand/groove-mark.svg"
                alt=""
                className="h-10 w-10 shrink-0 object-contain md:h-11 md:w-11"
              />
              <div className="min-w-0 border-l border-border/70 pl-3">
                <h1 className="whitespace-nowrap font-serif text-xl leading-none tracking-tight text-foreground md:text-2xl">
                  Groove Metronome
                </h1>
                <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground/80">
                  See it. Count it. Lock it in.
                </p>
              </div>
            </div>

            <nav className="app-space-nav app-space-nav-desktop grid grid-cols-3 gap-2" aria-label="Main app spaces">
              {APP_TABS.map((item) => (
                <AppTabButton
                  key={item.id}
                  item={item}
                  active={tab === item.id}
                  bpm={item.id === "metronome" && metronome.state.isPlaying ? Math.round(metronome.state.bpm) : undefined}
                  onSelect={() => {
                    if (item.id === "analyzer") prepareAnalyzerClick();
                    if (item.id === "analyzer" || item.id === "setlist") {
                      setVisitedTabs((prev) => ({ ...prev, [item.id]: true }));
                    }
                    setTab(item.id);
                  }}
                />
              ))}
            </nav>

            <div className="utility-cluster grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3 lg:grid-cols-1 lg:justify-items-end">
              <ShareStrip />
              <ThemeSwitch theme={theme} onThemeChange={setTheme} />
            </div>
          </div>
        </div>
      </header>

      <main className="app-main relative z-10 max-w-6xl mx-auto px-4 md:px-10 py-5 md:py-10">
        <div hidden={tab !== "metronome"}>
          <MetronomePage metronome={metronome} view={view} onViewChange={setView} active={tab === "metronome"} />
        </div>
        <div hidden={tab !== "analyzer"}>
          {visitedTabs.analyzer && (
            <Suspense fallback={<AppPaneFallback />}>
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
            </Suspense>
          )}
        </div>
        <div hidden={tab !== "setlist"}>
          {visitedTabs.setlist && (
            <Suspense fallback={<AppPaneFallback />}>
              <SetlistPage metronome={metronome} active={tab === "setlist"} />
            </Suspense>
          )}
        </div>
      </main>
      <nav className="app-space-nav-mobile grid grid-cols-3 gap-2" aria-label="Main app spaces">
        {APP_TABS.map((item) => (
          <AppTabButton
            key={item.id}
            item={item}
            active={tab === item.id}
            bpm={item.id === "metronome" && metronome.state.isPlaying ? Math.round(metronome.state.bpm) : undefined}
            onSelect={() => {
              if (item.id === "analyzer") prepareAnalyzerClick();
              if (item.id === "analyzer" || item.id === "setlist") {
                setVisitedTabs((prev) => ({ ...prev, [item.id]: true }));
              }
              setTab(item.id);
            }}
          />
        ))}
      </nav>
      <SeoFooter />
    </div>
  );
}

function AppPaneFallback() {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-5 font-mono text-xs text-muted-foreground">
      Loading...
    </div>
  );
}

function AppTabButton({
  item,
  active,
  bpm,
  onSelect,
}: {
  item: (typeof APP_TABS)[number];
  active: boolean;
  bpm?: number;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`hero-tab ${active ? "hero-tab-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="hero-tab-icon">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 text-left">
        <span className="hero-tab-title hero-tab-title-full">{item.label}</span>
        <span className="hero-tab-title hero-tab-title-short">{item.shortLabel}</span>
        <span className="hero-tab-detail">{bpm ? `${bpm} BPM live` : item.detail}</span>
      </span>
    </button>
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
