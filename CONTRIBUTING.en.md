# Contributing

Thanks for your interest in **[gaogg521-openclaw-Visual-Control-Panel](https://github.com/gaogg521/gaogg521-openclaw-Visual-Control-Panel)**.

Whether you commit by hand or with **any AI coding assistant**, follow **[CODE_STANDARDS.md](CODE_STANDARDS.md)** plus this workflow.

**Full guide (Chinese):** [CONTRIBUTING.md](CONTRIBUTING.md)

## Quick flow

1. Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
2. **Fork** the repo, branch from default branch (`main`): `feat/…`, `fix/…`, `docs/…`, `chore/…`.
3. One PR = one focused change.
4. Before opening a PR:
   - `npx tsc --noEmit`
   - `npm run build` (when you touch app/build-related code)
5. Follow [Conventional Commits](https://www.conventionalcommits.org/) if possible: `feat(scope): …`, `fix(scope): …`, etc.
6. Fill in the PR template; no secrets or machine-specific paths in commits.

## Project hints

- Next.js App Router under `app/`; APIs under `app/api/`.
- OpenClaw paths and CLI spawning: see `lib/openclaw-paths.ts`, `lib/openclaw-home-detect.ts`, `lib/openclaw-cli.ts`.
- i18n: `lib/i18n.tsx` and `lib/locales/*.json`.
- Code standards (humans and any AI coding tools): [CODE_STANDARDS.md](CODE_STANDARDS.md).

Questions: open a GitHub **Issue** (bug / feature templates) or use community channels listed in [README.md](README.md).
