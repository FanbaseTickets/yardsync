# YardSync Feedback Room

A persistent panel of customer personas that reviews features and triangulates feedback into a
profit-weighted build order. Goal lens: **maximize revenue while keeping a healthy ratio of
transacting members** (acquire members who generate 5.5% fee GMV and stay — not just signups).

## Files

| File | What it is |
|---|---|
| `00_PRODUCT_BRIEF.md` | The shared mental model every persona reads + candidate feature list (F1–F20) + output contract. Keep in sync with `YARDSYNC_KNOWLEDGE_BASE.md`. |
| `01_FEEDBACK_ROOM_FRAMEWORK.md` | How the room runs (cadence) + the profit-weighted triangulation rubric (the scoring math). |
| `personas/` | The 10 new persona subagents (3 originals live in `.claude/agents/`). 13-persona panel total. |
| `round-1-feedback.md` | Raw, in-voice responses from all 13 personas, Round 1. |
| `round-1-prioritization.md` | **The decision doc** — triangulated profit-weighted build order + fee-flight overlay + cost-benefit. |

## The 13-persona panel

Originals (in `.claude/agents/`): Marco · Dave (skeptic) · Eager newbie.
New (in `personas/`): Rosa (cleaning crew) · Tyrell (pressure-wash/social) · Jenny (pool/fee-flight) ·
Joaquín (pest/anti-tech) · Brittany (cleaning/maximalist) · Marcus (handyman/one-off) ·
Diego (landscape solo→crew) · Linda (window/low-volume floor) · Sasha (tree/high-ticket fee-flight) ·
Charlie (HVAC/recurring contracts).

## Running a round

1. Update `00_PRODUCT_BRIEF.md` to the current product state + the thing under review.
2. Spawn each persona as a subagent: have it read the brief + its own persona file, respond in the §7 output contract. Personas must not see each other's answers (independence = honest signal).
3. Aggregate with the rubric in `01_…FRAMEWORK.md` §3. Write `round-N-feedback.md` + `round-N-prioritization.md`.
4. Always capture the **fee-flight overlay** (§4 of the framework) — it's a first-class output, not a feature.

## Notes

- To let Claude Code auto-load the new personas as native subagents, copy them into `.claude/agents/`:
  `cp docs/feedback-room/personas/*.md .claude/agents/`
- Round 1 headline: the top profit move is a **fee-model redesign** (cap / ACH tier / recurring-agreement
  accommodation), not a feature — 9/13 personas would route their biggest payments outside YardSync at flat 5.5%.
