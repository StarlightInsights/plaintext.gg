# Philosophy

- **Honest by default.** Every claim in the UI must be literally true and
  verifiable in the code — no overstatement, no marketing that outruns the
  implementation.
- **Aggressively minimal dependencies.**
- **No externally hosted assets.** Everything is bundled and self-hosted so the
  app runs in a single container with no CDN dependencies.
- **Server never sees any user data.**

## Rules

- **Git and GitHub operations require explicit instruction.** Do not commit, push, or open a PR unless the user tells you to. Never merge — the user always does that manually.
- Agents must never delete files under `public/fonts/`, even if a weight is not currently referenced by an `@font-face` rule. The full set is retained intentionally.

## Deployment

- The site is hosted on Fly.io (app `plaintext-gg`, region `fra`). Production config is `fly.toml`; per-PR previews use `fly.preview.toml`. Deploys run from GitHub Actions (`.github/workflows/fly-deploy.yml` on push to `main`, `.github/workflows/fly-preview.yml` for PRs) and require the `FLY_API_TOKEN` repo secret.
- It is a static SPA: the `Dockerfile` builds with `vp build` and serves the output from `nginx:alpine` on port 80. There is no backend, database, or persistent volume — do not add one without explicit instruction.
