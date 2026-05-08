# Groove Metronome

## Production

🎶 **Live URL:** [metronome.nathanielschool.com](https://metronome.nathanielschool.com)

Vercel project `groove-metronome` (team `jasonzacmusics-projects`). Pushes to `main` auto-deploy to production. Build: `pnpm install --no-frozen-lockfile` + `pnpm run build`, output `dist/public`.

## How to talk to the user

The user is not a technical person. Read `~/.claude/CLAUDE.md` for the full rules. Short version:

- **Never** discuss Git, GitHub, branches, PRs, Vercel, deploys, build pipelines, DNS, domains, package managers, configs.
- **Never** ask the user to make a technical/process decision. Choose the safe sensible option and proceed.
- **Always** ship — when work is done, merge to `main` and let production deploy.
- **Always** end with the live URL: https://metronome.nathanielschool.com
- Reserve `AskUserQuestion` for genuinely musical product decisions only.

## Project mechanics (for Claude only — do not surface to user)

- Stack: Vite + React 19 + Tailwind 4 + Tone.js, TypeScript strict.
- Audio engine: `src/hooks/useMetronome.ts`. Per-beat subdivisions; each beat in the bar carries its own pulse count (1–8) and per-pulse accent (`normal` / `accent` / `ghost` / `mute`). Tone.Transport schedules one event per beat; sub-pulses fan out within the beat span.
- Hero UI: `src/components/metronome/PolyrhythmWheel.tsx`. Alternate `BarView.tsx`. Editorial layout in `MetronomePage.tsx`.
- Theme: deep warm graphite background, single amber accent, slate-cyan for active beat. Tokens in `src/index.css`.
- Run before push: `pnpm build` must pass.

## Branch policy

The user does not want to hear about branches. If you've been assigned a feature branch, work on it, then merge to `main` and push when done. Don't ask permission, don't summarize Git mechanics in your reply.
