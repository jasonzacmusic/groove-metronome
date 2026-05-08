import { useState } from "react";
import { Activity, FileAudio, Music2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMetronome } from "@/hooks/useMetronome";
import { AnalyzerPage } from "@/pages/AnalyzerPage";
import { MetronomePage } from "@/pages/MetronomePage";

export default function App() {
  const metronome = useMetronome();
  const [tab, setTab] = useState<"metronome" | "analyzer">("metronome");

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-5 h-5 text-primary" />
            <h1 className="font-serif text-xl">Groove Metronome</h1>
            {metronome.state.isPlaying && (
              <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-primary inline-flex items-center gap-1">
                <Activity className="w-3 h-3 animate-pulse" /> {Math.round(metronome.state.bpm)} BPM
              </span>
            )}
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-8">
              <TabsTrigger value="metronome" className="text-xs gap-1.5">
                <Music2 className="w-3.5 h-3.5" /> Metronome
              </TabsTrigger>
              <TabsTrigger value="analyzer" className="text-xs gap-1.5">
                <FileAudio className="w-3.5 h-3.5" /> Analyze
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {tab === "metronome" ? (
          <MetronomePage metronome={metronome} />
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
