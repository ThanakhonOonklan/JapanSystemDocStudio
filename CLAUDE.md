# Japan Documentation Studio

A web app for writing user manuals in Markdown and building them into PDF.
It is a trimmed fork of an open-source editor. Plan and status: PLAN.md. Install and usage: README.md (Thai).

## Build, test, run

- Build the image: see README.md, section "สร้าง Docker image". Run: `docker compose -f docker-compose.local.yml up -d`
- Only md-compile can be tested on the host: `cd services/md-compile && npm test`
- web, clsi and the front end cannot run vitest or tsc on the host (Yarn PnP). Test them in Docker, or write the logic as pure functions and run them with node:test.
- Never say a change "passes" without running it. Say NOT VERIFIED.

## Working rules (set by the user)

- Reply to the user in Thai. Write files in English.
- Never run `docker build` or recreate the container unless the user says so. One build per batch of work.
- Never commit unless the user says so. Commit only the files you changed: other sessions share this working tree.
- Before deleting a feature or files, survey what depends on it, tell the user, and wait for approval. (Removing git history is already approved.)
- Changes that touch login, permissions, user data, deleting or moving projects, deploy or migrations are R2: explain the plan and wait for approval first, and add tests for the refused cases.

## Things to know about this code

- Screen text: edit services/web/locales/en.json and frontend/extracted-translations.json together.
- Material icons: only names listed in frontend/fonts/material-symbols/unfilled-symbols.mjs render.
- Names such as @overleaf/*, OVERLEAF_* and /overleaf are internal and cannot be renamed (the build breaks). Text users see must not contain the upstream product name.
- Many files use CRLF. Edit them with the Edit tool; do not use multi-line regex through a heredoc.

## Shared guidance (this machine only)

Rules and the skill catalogue: C:\Users\zazaj\Documents\Obsidian Vault\Claude Code Plugins\index.md
If requirements are unclear, propose `grill-me` and wait for the user's yes (it is manual-only; the agent cannot start it).
Review R1/R2 changes before merge with one of `/code-review` or `ponytail-review`, not both.
