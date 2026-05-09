import { useState } from "react";

import { useMetronome } from "@/hooks/useMetronome";
import { AnalyzerPage } from "@/pages/AnalyzerPage";
import { MetronomePage } from "@/pages/MetronomePage";

type Tab = "metronome" | "analyzer";
type View = "wheel" | "bar";

export default function App() {
  const metronome = useMetronome();
  const [tab, setTab] = useState<Tab>("metronome");
  const [view, setView] = useState<View>("wheel");

  return (
    <div className="relative min-h-full bg-background text-foreground overflow-x-hidden">
      {/* Background layers */}
      <div className="warm-glow" aria-hidden />
      <div className="film-grain" aria-hidden />

      {/* Slim masthead */}
      <header className="relative z-10 border-b border-border/70">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-2xl md:text-3xl leading-none tracking-tight text-foreground">
              Groove
              <span className="text-primary">·</span>
              Metronome
            </h1>
            <span className="hidden md:inline tiny-caps text-[9px] text-muted-foreground/70">
              Atelier Edition
            </span>
          </div>

          <nav className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-4 sm:gap-5 tiny-caps text-[9px] sm:text-[10px]">
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
              <span className="ml-3 tiny-caps text-[10px] text-primary tabular flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {Math.round(metronome.state.bpm)}
              </span>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-8 md:py-12">
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
