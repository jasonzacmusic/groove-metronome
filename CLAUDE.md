# Groove Metronome

## Deployment

- **Production domain:** [metronome.nathanielschool.com](https://metronome.nathanielschool.com) (Vercel custom domain)
- **Vercel project:** `groove-metronome` (id `prj_dSPEnYh2XncxhnWQxWgTKdH2VWFh`, team `jasonzacmusics-projects`)
- Production deploys from `main`. Feature branches get auto-generated preview URLs of the form `groove-metronome-git-<branch>-jasonzacmusics-projects.vercel.app`.

## Always do

- After pushing changes, always surface the relevant Vercel URL(s):
  - The branch preview alias if work is on a feature branch.
  - The production URL (`metronome.nathanielschool.com`) if work has been merged to `main`.
- If a deploy is missing/stale, tell the user explicitly which branch the production domain is currently pointing at.
- Use `pnpm` (project is configured for it; Vercel uses `pnpm install --no-frozen-lockfile` + `pnpm run build`).
- Build output is `dist/public` (per `vercel.json`).

## Branch policy

- All Claude Code work goes on the assigned feature branch (e.g. `claude/...`). Never push directly to `main` or merge to `main` without explicit user confirmation.
