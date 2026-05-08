import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TempoAnalysisResult } from "@/lib/audio-tempo";

interface AudioAnalysisCardProps {
  fileName: string;
  result: TempoAnalysisResult;
  onUseAsBpm: (bpm: number) => void;
}

export function AudioAnalysisCard({ fileName, result, onUseAsBpm }: AudioAnalysisCardProps) {
  const inconsistent = result.windows.filter((w) => w.agreement < 0.5);
  const tightness = result.jitterSec < 0.02 ? "tight" : result.jitterSec < 0.05 ? "moderate" : "loose";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Audio analysis</CardTitle>
          <Badge variant="outline" className="font-mono text-xs">{fileName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Tempo</div>
            <div className="font-mono tabular-nums text-5xl font-bold text-primary leading-none">
              {result.bpm.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">BPM</div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Confidence" value={`${(result.confidence * 100).toFixed(0)}%`} />
              <Stat label="Onsets" value={String(result.onsets.length)} />
              <Stat label="Jitter" value={`${(result.jitterSec * 1000).toFixed(0)} ms`} />
              <Stat label="Length" value={`${result.durationSec.toFixed(1)} s`} />
              <Stat label="Sample rate" value={`${(result.sampleRate / 1000).toFixed(1)} kHz`} />
              <Stat label="Tightness" value={tightness} />
            </div>
          </div>
          <Button size="sm" onClick={() => onUseAsBpm(Math.round(result.bpm))}>
            Use as BPM
          </Button>
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed">
          <div className="font-medium text-foreground mb-1">How we got this</div>
          <p className="text-muted-foreground">{result.explanation}</p>
        </div>

        {/* Per-window timeline */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Stability</div>
            {inconsistent.length === 0 ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CheckCircle2 className="w-3 h-3" /> Steady throughout
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="w-3 h-3" /> {inconsistent.length} unsteady region{inconsistent.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <div className="flex h-7 w-full overflow-hidden rounded-md border border-border">
            {result.windows.map((w, i) => {
              const hue = w.agreement >= 0.7 ? "bg-sage" : w.agreement >= 0.4 ? "bg-primary/70" : "bg-coral";
              return (
                <div
                  key={i}
                  className={`${hue} flex-1 border-r border-border last:border-r-0 relative group`}
                  title={`${w.startSec.toFixed(1)}–${w.endSec.toFixed(1)}s · ${w.bpm.toFixed(1)} BPM · agreement ${(w.agreement * 100).toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
            <span>0:00</span>
            <span>{Math.floor(result.durationSec / 60)}:{String(Math.floor(result.durationSec % 60)).padStart(2, "0")}</span>
          </div>
        </div>

        {/* Alternative tempo candidates */}
        {result.candidates.length > 1 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono mb-1">Alternatives</div>
            <div className="flex flex-wrap gap-1.5">
              {result.candidates.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onUseAsBpm(Math.round(c.bpm))}
                  className="px-2 py-1 rounded-full text-[11px] font-mono bg-muted/40 hover:bg-muted/70 transition-colors"
                >
                  {c.bpm.toFixed(1)} ({(c.score * 100).toFixed(0)}%)
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/20 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className="font-mono tabular-nums text-sm">{value}</div>
    </div>
  );
}
