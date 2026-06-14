# YardSync — Working Guide (VS-Claude)

*How work flows now that production is live and dev/prod are isolated. Living document — build on it.*
*Last updated: 2026-06-14*

---

## 1. Environment map (what lives where)

| You're working on… | Lands on | URL | Firebase | Stripe |
| --- | --- | --- | --- | --- |
| `main` branch | **Production** | yardsyncapp.com | yardsync-41886 (LIVE) | LIVE keys |
| any `feat/*` branch | **Preview** | yardsync-git-<branch>.vercel.app | yardsync-dev (TEST) | TEST keys |
| your laptop | **Local** | localhost:3000 | yardsync-dev (TEST) | TEST keys |

**The one rule that makes all of this safe:** `main` = production = real money + real contractors. You never touch it directly. Everything else (branches, Preview, local) is the practice field on test data. Cron jobs (the daily SMS) run **only** on production, so Preview/local never auto-text anyone.

---

## 2. Building something new — the loop

This is the cycle for every change, from a one-line fix to a new feature. Branch protection now **enforces** it — you can't skip steps even if you wanted to.

1. **Branch off main** — `git checkout -b feat/<short-name>` (e.g. `feat/payment-logo`)
2. **Build + commit** on that branch
3. **Push** — `git push origin feat/<short-name>` → Vercel automatically spins up a **Preview URL** on the dev/test environment
4. **Test on the Preview URL** — sign up, click around, use test card `4242 4242 4242 4242`. This is all dev data; nothing touches production.
5. **Open a Pull Request** (feat → main) on GitHub
6. **Wait for the green Vercel check** on the PR — a broken build blocks the merge
7. **Merge** → production auto-deploys to yardsyncapp.com

### Who does what
- **VS-Claude:** creates the branch, writes the code, commits, pushes, opens the PR, updates docs.
- **You:** describe what you want built, test it on the Preview URL, and click **Merge** — the one deliberate "ship to production" moment. Also handle any Console/Vercel clicks and sign-in prompts.

### Kickoff prompt (paste into VS-Claude to start new work)
```
I want to build: <describe the feature/change>.
Create a feat/<short-name> branch off main, implement it, commit, push, and
open a PR to main. Do NOT push to main directly. Tell me the Preview URL so
I can test on dev, and stop before merging — I'll merge once it's green.
```

---

## 3. End-of-session shutdown — "end my day"

When you're done for the day, this is what should happen so the next session picks up clean and nothing is lost or left exposed.

1. **Finalize work in progress** — commit (or stash) any uncommitted changes to the current `feat/*` branch. Never leave work uncommitted.
2. **Push the branch** — so it's backed up on GitHub (and the Preview reflects the latest).
3. **Leave nothing half-done on main** — unfinished PRs stay open or as drafts; never merge incomplete work to production.
4. **Update the running notes** — todo list + CLAUDE.md / YARDSYNC_KNOWLEDGE_BASE.md / memory file: what got done, what's in progress, and the **next concrete step**.
5. **Scrub sensitive temp files** — delete any `.gcloud-token`, proposal JSON, or other credential/scratch files. Confirm no secrets are in the working tree.
6. **Confirm clean state** — `git status` shows only intended changes; the active branch is pushed.
7. **Commit + push the notes/docs** updates.
8. **(After infra or prod-adjacent changes) quick health check** — hit `/api/cron/health` and confirm `status: healthy` against yardsync-41886.
9. **Report a 3-line summary:** Done / In progress / Next step.

### Shutdown prompt (paste into VS-Claude to end the day)
```
End my day. Run the shutdown checklist:
1. Commit or stash any work in progress to the current feat branch and push it.
2. Confirm nothing incomplete is merged to main; leave unfinished PRs open/draft.
3. Update the todo list + CLAUDE.md / knowledge base / memory with what got
   done, what's in progress, and the next concrete step.
4. Scrub any token/scratch files; confirm no secrets in the working tree.
5. Run git status and confirm it's clean / pushed.
6. Commit + push the docs/notes updates.
7. If we touched anything prod-adjacent, run the health check and confirm healthy.
Then give me a 3-line summary: Done / In progress / Next step.
```

---

## 4. Standing conventions & safety rules

- **No Firebase Admin SDK / service-account keys** — the org blocks them. Server/admin operations authenticate via a **gcloud OAuth token** in `process.env.GCLOUD_TOKEN`, or the app's `firestoreRest` email/password pattern. On Windows PowerShell 5.1, use the `auth/disable_ssl_validation` toggle for token fetches and capture the token with `-Encoding ascii` (the PowerShell 5.1-compatible BOM-free option — `utf8NoBOM` is PowerShell 7+ only).
- **Maintenance scripts are dry-run by default; `--execute` to actually change data.** The three tracked tools: `cleanup-test-users.mjs` (per-user hygiene), `firestore-integrity-audit.mjs` (full-store sweep), `polish-victor-demo.mjs` (demo refresh — re-run quarterly so the demo calendar stays current).
- **Secrets live only in Vercel** (and the gitignored `.env.local`). Never commit a secret. Identifiers (price IDs, account IDs, Messaging Service SID) are fine.
- **Production holds exactly 3 accounts:** `admin@fanbasetickets.net`, `rub@test.com`, `scals@test.com` (Victor Scales). Any *new* name that appears in production Auth that isn't one of these is a **real signup** — not test junk.
- **Demo safety:** every Victor Scales client routes to your phone/email, so no cron reminder or invoice can reach a third party. Keep it that way on any demo refresh.
- **Test on Preview/dev, never on production.** That's the whole point of the split.

---

## 5. Where this doc lives

Committed to the repo at `docs/WORKING_GUIDE.md`, referenced from `CLAUDE.md` (which Claude Code auto-loads at the start of every session). Refine as the workflow evolves — this is a living document.
