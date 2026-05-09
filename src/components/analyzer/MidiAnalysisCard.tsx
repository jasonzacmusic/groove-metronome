import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MidiAnalysis } from "@/lib/midi-analyzer";

interface MidiAnalysisCardProps {
  analysis: MidiAnalysis;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
}

export function MidiAnalysisCard({ analysis, onUseAsBpm, onUseAsTimeSignature }: MidiAnalysisCardProps) {
  const ts = analysis.timeSignatures[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">MIDI analysis</CardTitle>
          <Badge variant="outline" className="font-mono text-xs">{analysis.fileName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Tempo</div>
            <div className="font-mono tabular-nums text-5xl font-bold text-primary leading-none">
              {analysis.bpm.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              BPM{analysis.bpmVariation > 0.5 ? ` · ±${(analysis.bpmVariation / 2).toFixed(1)}` : ""}
            </div>
          </div>
          <div className="flex-1 min-w-[280px]">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Time sig" value={`${ts.numerator}/${ts.denominator}`} />
              <Stat label="Weighted" value={analysis.weightedBpm.toFixed(1)} />
              <Stat label="Key" value={`${analysis.keyEstimate.tonic} ${analysis.keyEstimate.mode}`} />
              <Stat label="Length" value={`${analysis.durationSec.toFixed(1)} s`} />
              <Stat label="Notes" value={analysis.totalNotes.toLocaleString()} />
              <Stat label="Sections" value={String(analysis.sections.length)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" onClick={() => onUseAsBpm(Math.round(analysis.bpm))}>
              Use as BPM
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUseAsTimeSignature(ts.numerator, ts.denominator)}
            >
              Use {ts.numerator}/{ts.denominator}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed">
          <div className="font-medium text-foreground mb-1">Summary</div>
          <p className="text-muted-foreground">{analysis.explanation}</p>
        </div>

        {analysis.sections.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono mb-2">
              Sections
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.sections.map((section) => (
                <div key={section.index} className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-lg">Section {section.index}</span>
                    <span className="font-mono text-xs text-primary">{section.bpm.toFixed(1)} BPM</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>{formatClock(section.startSec)}–{formatClock(section.endSec)}</span>
                    <span>{section.estimatedBars} bars</span>
                    <span>{section.noteCount} notes</span>
                    <span>{section.topChord}</span>
                    <span>{section.keyEstimate.tonic} {section.keyEstimate.mode}</span>
                    <span>{section.density.toFixed(1)} n/s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tempo timeline (if performance) */}
        {analysis.isPerformance && analysis.tempos.length > 1 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono mb-1">
              Tempo over time
            </div>
            <TempoTimeline tempos={analysis.tempos} duration={analysis.durationSec} />
          </div>
        )}

        {/* Tracks */}
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono mb-2">
            Tracks ({analysis.tracks.length})
          </div>
          <div className="space-y-1.5">
            {analysis.tracks.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {t.instrument} · ch {t.channel + 1}
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums text-[11px] text-muted-foreground">
                  <span title="Note count">{t.noteCount}n</span>
                  <span title="Average velocity">v{Math.round(t.avgVelocity * 127)}</span>
                  <span title="Max polyphony">p{t.maxPolyphony}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TempoTimeline({ tempos, duration }: { tempos: { timeSec: number; bpm: number }[]; duration: number }) {
  const minBpm = Math.min(...tempos.map((t) => t.bpm)) - 2;
  const maxBpm = Math.max(...tempos.map((t) => t.bpm)) + 2;
  const range = Math.max(1, maxBpm - minBpm);
  const w = 600;
  const h = 60;
  const pts = tempos.map((t) => {
    const x = (t.timeSec / Math.max(duration, 0.01)) * w;
    const y = h - ((t.bpm - minBpm) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
        <span>{minBpm.toFixed(0)} BPM</span>
        <span>{maxBpm.toFixed(0)} BPM</span>
      </div>
    </div>
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

function formatClock(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
