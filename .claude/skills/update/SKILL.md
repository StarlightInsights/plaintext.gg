---
name: update
description: Bump all project dependencies (GitHub Actions, Dockerfile, package.json) on a new branch, update the codebase to match the new APIs, verify everything still passes, open a PR, and watch CI through to green. Invoke via /update.
---

# Update dependencies

End-to-end dependency-bump workflow. Execute the steps in order.

## 1. Create the branch

Create and check out a new branch:

- Branch name: `update-YYYY-MM-DD-HHMM` (today's date and time)

## 2. Bump dependencies to latest stable

Update each location to the latest non-prerelease versions:

- **GitHub Actions** — every `uses:` line in `.github/workflows/*.yml`
- **Dockerfile** — base images and any pinned tool versions
- **package.json** — both `dependencies` and `devDependencies`; refresh the lockfile with the project's package manager

Track major version bumps separately — they're the ones likely to need code changes in the next step.

## 3. Update the codebase to match

New versions deprecate or rename APIs. Don't leave call sites on the old API just because it still compiles.

For each major bump:

- Skim the release notes / changelog for breaking changes and deprecations.
- Grep the codebase for usages of changed/removed APIs and migrate them.
- Update `.conductor/settings.toml` scripts if any commands or flags changed, and confirm they still run.

## 4. Verify

Run the full test suite plus lint and type checks. Everything must pass before opening a PR — fixing failures introduced by the bump is part of this skill's job, not a follow-up task.

## 5. Open the PR

1. `git diff` — review uncommitted changes.
2. Commit them.
3. Push to origin.
4. `git diff origin/main...` — sanity-check the full PR diff.
5. Build the Report Summary table (see step 7) with current counts and `Verification: passed`, `PR: pending`.
6. Create the PR with that summary as the body:
   ```
   gh pr create --base main --title "Update YYYY-MM-DD" --body "<report summary>"
   ```

## 6. Watch CI and fix failures (max 5 attempts)

Watch checks with `gh pr checks <pr-number> --watch 2>&1`.

- **All pass** → go to step 7.
- **Any fail** → fetch failed logs with `gh run view <run-id> --log-failed`, diagnose, fix, commit with message `Fix CI: <description>`, push, and re-watch.

Cap the fix loop at **5 attempts**. If CI is still red after 5, stop and report: _"CI failed after 5 fix attempts. Manual intervention required."_ Include a brief list of what was tried.

## 7. Final report

Present this summary to the user **and** update the PR description with it via `gh pr edit <pr-number> --body "..."`:

| Category       | Status                          |
| -------------- | ------------------------------- |
| Dockerfile     | {N} updated                     |
| GitHub Actions | {N} updated                     |
| package.json   | {N} updated                     |
| Verification   | passed / failed                 |
| CI             | green / failed after 5 attempts |
