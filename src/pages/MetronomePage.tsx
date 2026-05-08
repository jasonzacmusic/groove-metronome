import { useEffect } from "react";
import { ChevronDown, ChevronUp, Settings2, Timer, TrendingUp, Zap, Music2 } from "lucide-react";
import { useState } from "react";

import { AccentGrid } from "@/components/metronome/AccentGrid";
import { BPMDial } from "@/components/metronome/BPMDial";
import { NotationPanel } from "@/components/metronome/NotationPanel";
import { TransportButton } from "@/components/metronome/TransportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { UseMetronomeReturn } from "@/hooks/useMetronome";
import {
  METRONOME_PRESETS,
  TEMPO_PRESETS,
  type BeatSound,
  type Subdivision,
} from "@/lib/metronome-types";
import { clamp, formatTime } from "@/lib/utils";

const SOUNDS: BeatSound[] = ["click", "woodblock", "rimshot", "cowbell", "clave"];
const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: "none", label: "None" },
  { value: "8th", label: "8th" },
  { value: "16th", label: "16th" },
  { value: "triplet", label: "3-let" },
  { value: "quintuplet", label: "5-let" },
  { value: "septuplet", label: "7-let" },
];

interface MetronomePageProps {
  metronome: UseMetronomeReturn;
}

export function MetronomePage({ metronome }: MetronomePageProps) {
  const {
    state,
    setBpm,
    setTimeSignature,
    setBeatSound,
    setSubdivision,
    setSwing,
    setTrainerEnabled,
    setTrainerConfig,
    setRampEnabled,
    setRampConfig,
    setAccents,
    toggle,
    tap,
    adjustBpm,
    cycleAccent,
  } = metronome;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [targetMinutes, setTargetMinutes] = useState(5);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      else if (e.code === "ArrowUp") { e.preventDefault(); adjustBpm(1); }
      else if (e.code === "ArrowDown") { e.preventDefault(); adjustBpm(-1); }
      else if (e.key === "t" || e.key === "T") tap();
      else if (e.key === "[") { e.preventDefault(); adjustBpm(-5); }
      else if (e.key === "]") { e.preventDefault(); adjustBpm(5); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, adjustBpm, tap]);

  const loadPreset = (idx: number) => {
    const p = METRONOME_PRESETS[idx];
    setBpm(p.bpm);
    setTimeSignature({ numerator: p.timeSig[0], denominator: p.timeSig[1] });
    setSubdivision(p.subdivision);
    setSwing(p.swing);
    setAccents(p.accents);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Preset selector */}
      <div className="flex justify-center">
        <Select onValueChange={(v) => loadPreset(Number(v))}>
          <SelectTrigger className="w-56 font-mono text-xs">
            <SelectValue placeholder="Load preset…" />
          </SelectTrigger>
          <SelectContent>
            {METRONOME_PRESETS.map((p, i) => (
              <SelectItem key={p.name} value={String(i)}>
                {p.name} ({p.bpm} BPM)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hero: Dial + Transport */}
      <Card className="dot-grid">
        <CardContent className="pt-6 pb-5 space-y-5">
          <BPMDial
            bpm={state.bpm}
            onChange={(b) => setBpm(clamp(b, 20, 300))}
            isPlaying={state.isPlaying}
            currentBeat={state.currentBeat}
            beatsPerBar={state.timeSignature.numerator}
          />

          {/* Fine adjust + slider */}
          <div className="flex items-center justify-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 w-9 text-[10px] font-mono" onClick={() => adjustBpm(-10)}>−10</Button>
            <Button variant="outline" size="sm" className="h-8 w-9 text-xs font-mono" onClick={() => adjustBpm(-1)}>−1</Button>
            <input
              type="number"
              value={Math.round(state.bpm)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 20 && v <= 300) setBpm(v);
              }}
              className="w-20 bg-muted/30 border border-border rounded-md px-2 py-1 text-center font-mono text-sm"
              min={20}
              max={300}
              aria-label="BPM"
            />
            <Button variant="outline" size="sm" className="h-8 w-9 text-xs font-mono" onClick={() => adjustBpm(1)}>+1</Button>
            <Button variant="ghost" size="sm" className="h-7 w-9 text-[10px] font-mono" onClick={() => adjustBpm(10)}>+10</Button>
          </div>
          <div className="px-2">
            <Slider value={[state.bpm]} min={20} max={300} step={1} onValueChange={([v]) => setBpm(v)} />
          </div>

          {/* Tempo presets */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {TEMPO_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setBpm(p.bpm)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-colors
                  ${Math.abs(state.bpm - p.bpm) < 5 ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              >
                {p.label} {p.bpm}
              </button>
            ))}
          </div>

          {/* Tap + Transport */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" className="font-mono text-sm tracking-wide" onClick={tap}>
              TAP{state.tapInfo.count > 0 ? ` (${state.tapInfo.count}${state.tapInfo.avgBpm ? ` = ${state.tapInfo.avgBpm}` : ""})` : ""}
            </Button>
            <TransportButton isPlaying={state.isPlaying} onToggle={toggle} />
            <div className="font-mono text-xs text-muted-foreground tabular-nums w-12 text-center">
              {state.isPlaying ? `Bar ${state.barCount + 1}` : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beat indicators + accents */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <AccentGrid accents={state.accents} currentBeat={state.currentBeat} onCycle={cycleAccent} />
          {state.trainerEnabled && state.isPlaying && (
            <div className="flex justify-center">
              <Badge variant={state.trainerPhase === "muted" ? "destructive" : "secondary"} className="font-mono text-xs">
                Trainer · {state.trainerPhase.toUpperCase()}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notation */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Music2 className="w-4 h-4 text-primary" /> Rhythm notation
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <NotationPanel
            timeSignature={state.timeSignature}
            subdivision={state.subdivision}
            currentBeat={state.currentBeat}
            isPlaying={state.isPlaying}
          />
        </CardContent>
      </Card>

      {/* Time signature */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block font-mono">Beats</label>
          <Select
            value={String(state.timeSignature.numerator)}
            onValueChange={(v) => setTimeSignature({ ...state.timeSignature, numerator: Number(v) })}
          >
            <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block font-mono">Note value</label>
          <Select
            value={String(state.timeSignature.denominator)}
            onValueChange={(v) => setTimeSignature({ ...state.timeSignature, denominator: Number(v) })}
          >
            <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2, 4, 8, 16].map((d) => (
                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sound + subdivision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" /> Sound
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {SOUNDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setBeatSound(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors
                    ${state.beatSound === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5 text-primary" /> Subdivision
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {SUBDIVISIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSubdivision(value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${state.subdivision === value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Swing */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Swing</span>
            <span className="font-mono text-xs text-muted-foreground tabular">{state.swing}%</span>
          </div>
          <Slider value={[state.swing]} min={-100} max={100} step={1} onValueChange={([v]) => setSwing(v)} />
        </CardContent>
      </Card>

      {/* Advanced */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" /> Practice tools
            </span>
            {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Tempo Ramp */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> Tempo ramp
                </CardTitle>
                <Switch checked={state.rampEnabled} onCheckedChange={setRampEnabled} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <NumberField
                  label="Start"
                  value={state.rampConfig.startBpm}
                  onChange={(v) => setRampConfig({ ...state.rampConfig, startBpm: clamp(v, 20, 300) })}
                />
                <NumberField
                  label="End"
                  value={state.rampConfig.endBpm}
                  onChange={(v) => setRampConfig({ ...state.rampConfig, endBpm: clamp(v, 20, 300) })}
                />
                <NumberField
                  label="Bars"
                  value={state.rampConfig.durationBars}
                  onChange={(v) => setRampConfig({ ...state.rampConfig, durationBars: Math.max(1, v) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ramp-loop"
                  checked={state.rampConfig.loop}
                  onCheckedChange={(checked) => setRampConfig({ ...state.rampConfig, loop: checked })}
                />
                <label htmlFor="ramp-loop" className="text-[10px] text-muted-foreground uppercase tracking-wide font-mono">
                  Loop ramp
                </label>
              </div>
              {state.rampProgress && (
                <div className="mt-3 text-center">
                  <p className="font-mono text-xs text-primary font-medium">
                    Bar {state.rampProgress.bar}/{state.rampConfig.durationBars} · {state.rampProgress.currentBpm} → {state.rampConfig.endBpm} BPM
                  </p>
                  <div className="mt-1.5 w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${(state.rampProgress.bar / state.rampConfig.durationBars) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trainer */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Mute trainer
                </CardTitle>
                <Switch checked={state.trainerEnabled} onCheckedChange={setTrainerEnabled} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Play (bars)"
                  value={state.trainerConfig.playBars}
                  onChange={(v) => setTrainerConfig({ ...state.trainerConfig, playBars: Math.max(1, v) })}
                />
                <NumberField
                  label="Mute (bars)"
                  value={state.trainerConfig.muteBars}
                  onChange={(v) => setTrainerConfig({ ...state.trainerConfig, muteBars: Math.max(1, v) })}
                />
              </div>
              <div className="flex gap-0.5 mt-3">
                {Array.from({ length: state.trainerConfig.playBars + state.trainerConfig.muteBars }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 flex-1 rounded-sm ${i < state.trainerConfig.playBars ? "bg-sage/70" : "bg-destructive/40"}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Practice Timer */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-primary" /> Practice timer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-3xl font-bold tabular-nums">
                    {formatTime(state.practiceSeconds)}
                  </span>
                  {targetMinutes > 0 && (
                    <span className="text-muted-foreground font-mono text-sm ml-2">
                      / {formatTime(targetMinutes * 60)}
                    </span>
                  )}
                </div>
                <NumberField label="Target (min)" value={targetMinutes} onChange={(v) => setTargetMinutes(Math.max(0, v))} />
              </div>
              {targetMinutes > 0 && (
                <div className="mt-2 w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (state.practiceSeconds / (targetMinutes * 60)) * 100)}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="text-center text-[10px] text-muted-foreground/60 font-mono space-y-0.5 pt-2">
        <p>Space = play/stop · T = tap · ↑/↓ = ±1 BPM · [/] = ±5 BPM</p>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-mono">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-muted/30 border border-border rounded-md px-2 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
