# Product Vision and Handoff Documentation Implementation Plan

> **Status:** Completed on `codex/hosted-chatgpt-connector`. The checked steps below describe this documentation update; Git remains the authoritative record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish durable product direction and a reliable current-state handoff without duplicating feature specifications or operational sources of truth.

**Architecture:** Use one durable vision, one domain glossary, decision-specific ADRs/specs, and dated handoffs. Route future agents through concise pointers in `AGENTS.md`, and label old execution checklists as historical.

**Tech Stack:** Markdown, Git, GitHub CLI, repository verification commands

---

### Task 1: Establish the documentation hierarchy

**Files:**
- Create: `docs/PRODUCT_VISION.md`
- Create: `docs/handoffs/2026-09-14-hosted-connector-and-on-hold.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Write the durable product vision**

Define the primary user, jobs, principles, current boundary, ordered product priorities, measurable success signals, non-goals, and the authority relationship among vision, glossary, decisions, plans, and handoffs.

- [x] **Step 2: Write the dated handoff**

Record the verified branch, pull request, production endpoint, deployed capability, evidence, known limitations, safety boundaries, suggested skills, and exact resume commands. Reference existing specifications rather than copying them.

- [x] **Step 3: Add agent context pointers**

Add concise triggers to `AGENTS.md` requiring the product vision and glossary for product decisions and the newest handoff for resumed work.

### Task 2: Reconcile stale documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-13-on-hold-opportunities-design.md`
- Modify: `docs/superpowers/plans/2026-09-06-sfl-brain-v0-1.md`
- Modify: `docs/superpowers/plans/2026-09-06-sfl-brain-v0-2-content-opportunities.md`
- Modify: `docs/superpowers/plans/2026-09-13-hosted-chatgpt-connector.md`
- Modify: `docs/superpowers/plans/2026-09-13-on-hold-opportunities.md`

- [x] **Step 1: Correct current behavioral statements**

Change the README read-tool count to eight and document the On hold view. Change the On hold specification so a non-empty Content backlog search uses the all-attention scope and labels held matches.

- [x] **Step 2: Label execution plans**

Add a status notice explaining that unchecked boxes preserve the original plan and that current status comes from Git, the pull request, and the newest handoff.

### Task 3: Verify and commit

**Files:**
- Verify all files above

- [x] **Step 1: Check links, placeholders, contradictions, and whitespace**

Run:

```powershell
rg -n "T[B]D|T[O]DO|seven read tool[s]|explicit website search remains scope[d]" docs README.md AGENTS.md
git diff --check
```

Expected: no stale phrases, placeholders, or whitespace errors.

- [x] **Step 2: Inspect the complete documentation diff and repository status**

Run:

```powershell
git diff --stat
git diff
git status --short --branch
```

Expected: only the documentation system and identified reconciliation files changed.

- [x] **Step 3: Commit the documentation**

Run:

```powershell
git add -- AGENTS.md README.md CONTEXT.md docs
git commit -m "docs: add product vision and current handoff"
```

Expected: one focused documentation commit; pushing remains a separate authorized action.
