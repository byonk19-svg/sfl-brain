# Product Vision and Handoff Documentation Design

## Goal

Give a new maintainer or agent enough authoritative context to understand why SFL Brain exists, distinguish present capability from future direction, and resume work without reconstructing production state from old chats or unchecked implementation plans.

## Documentation hierarchy

The documentation has four distinct levels:

1. `docs/PRODUCT_VISION.md` is the durable product authority: user, outcomes, principles, current product boundary, priorities, success signals, and non-goals.
2. `CONTEXT.md` is the canonical domain-language glossary.
3. ADRs and feature specifications record why individual architectural and behavioral decisions were made.
4. Dated files under `docs/handoffs/` record time-bound repository, deployment, verification, limitations, and next-step state.

Implementation plans are execution artifacts. Their checkboxes preserve the original work sequence and are not a current progress tracker after execution has moved to commits and pull requests.

## Agent routing

`AGENTS.md` contains two short context pointers. Product or behavior decisions trigger the product vision and glossary. Resuming an existing feature, deployment, or incident triggers the newest handoff plus verification against Git and hosted state.

## Reconciliation

The current README and On hold specification are updated to match deployed behavior: there are eight read tools, and a non-empty search from the Content backlog searches active and held opportunities while labeling held matches. Current plan files receive a historical-plan notice instead of retroactively checking steps that were not tracked during execution.

## Safety and maintenance

The handoff contains no credentials or private email addresses. Hosted identifiers that are already operational project references may be recorded, but every drift-prone claim is labeled with its verification date and must be rechecked before mutation. New handoffs reference stable artifacts rather than copying their full contents.

## Acceptance

- A new agent can find the product authority and current handoff from `AGENTS.md`.
- Product vision distinguishes current capability, prioritized direction, and non-goals.
- The handoff names the exact branch, pull request, production endpoint, verification evidence, guardrails, known limitations, and next actions.
- Known README/spec contradictions are removed.
- Historical implementation plans cannot be mistaken for live progress trackers.
- A repository search finds no placeholders in the new documents.
