# SFL Brain Product Vision

## Purpose

SFL Brain is the private operating memory for Styled For Less. It turns scattered ideas, products, photos, captions, affiliate links, publication history, and results into a durable workflow Elaine can use from the website or through ChatGPT.

The product succeeds when Elaine can stop remembering where everything lives and instead ask two ordinary questions: “What should I work on now?” and “What did I use last time?” SFL Brain supplies the factual, persistent answer; ChatGPT supplies the conversational help.

## Primary user and jobs

Elaine is the primary user. A maintainer supports the system but is not the center of the product experience.

SFL Brain should help Elaine:

1. Capture an idea in seconds, before every product, link, or image is known.
2. See the best next content work without blocked or unsuitable ideas competing for attention.
3. Develop one content opportunity across products, assets, copy, destinations, and publication history.
4. Retrieve prior content packages instead of searching long chats, notes, or a camera roll.
5. Record results and recognize when proven content is worth reviving.
6. Use the same durable information from a new ChatGPT conversation or another device while the developer computer is off.

## Product principles

### Opportunity-first

The editorial unit is a Content Opportunity. Products, listings, links, assets, captions, publications, and metrics support that opportunity; they do not replace it as the unit Elaine plans and remembers.

### Durable facts, conversational interface

SFL Brain stores durable business state. ChatGPT may explain, compare, or propose changes, but important facts must survive beyond one conversation and remain visible on the website.

### Explainable attention

Recommendations must use explicit stages, effort, readiness, availability, history, performance, and variety. Elaine should be able to understand why an item appears, why it is blocked, or why it is on hold.

### Human control before automation

Writes are explicit, attributable, and confirmed. Conditions that cannot yet be checked reliably remain manual. Automation is introduced only when SFL Brain can observe every required input, explain the change, preserve history, and notify Elaine when it acts without her present.

### Private by default

Every website and hosted connector request is tied to an authenticated member and an explicit workspace membership. Credentials, private storage paths, and conversation transcripts do not become product data.

### Available without the developer computer

The production website, database, private asset storage, and ChatGPT connector are hosted services. Local servers and the development tunnel support development only and are never production dependencies.

### One state across surfaces

Website and ChatGPT workflows operate on the same domain services and authorization rules. A change made through one surface must be visible through the other.

## Current product boundary

The current product provides:

- opportunity capture, stages, next actions, effort, products, links, assets, and publication context;
- deterministic Today recommendations with explainable ranking;
- an active Backlog plus an On hold lifecycle with reasons, release conditions, optional review dates, history, and manual release;
- product, listing, affiliate-link, asset, publication, performance, and manually recorded Revival Radar facts;
- a private authenticated website;
- an always-on OAuth-protected ChatGPT connector with eight read tools and six confirmed, non-destructive write tools.

Feature-level behavior belongs in the current specifications and code, not in this vision document.

## Prioritized direction

### 1. Post Package and content archive

Make each opportunity the durable home for original images and video, selected hero assets, Canva output, destination-specific caption drafts and final copy, commerce links, and the exact package used for each publication. Retrieval must work from both the website and ChatGPT.

### 2. Destination and publication completeness

Make Page, Instagram, SFL groups, personal-profile groups, and future destinations explicit enough that Elaine can record where each version went, which copy and assets it used, and its permalink without duplicating the underlying opportunity.

### 3. Results and decision support

Reduce manual reconstruction of clicks, sales, commission, reach, and content performance. Preserve source and observation time, distinguish facts from interpretations, and connect results to the opportunity and publication that produced them.

### 4. Trusted condition monitoring

Support review dates and release conditions only from authorized, observable sources. When SFL Brain can independently prove that every condition is satisfied, it may propose or perform an automatic release and must notify Elaine of the change.

### 5. Controlled workflow automation

Automate repetitive preparation only after the underlying content archive, destinations, and measurements are dependable. Automation should reduce clerical work without silently publishing, deleting, or changing editorial intent.

## Success signals

- Elaine can begin a new ChatGPT conversation and recover the current backlog and relevant history from SFL Brain without relying on an older chat.
- Elaine can identify a credible next post and understand the recommendation in under a minute.
- A completed opportunity contains enough assets, copy, links, destination history, and results to reproduce or thoughtfully revive the work later.
- Held or blocked ideas do not distract from active work but remain findable with their rationale intact.
- Website and ChatGPT show consistent state, and the production connector works while the developer computer is off.
- Every automated or conversational mutation has an authenticated actor, a clear source, and an understandable outcome.

## Non-goals until explicitly promoted

- autonomous external publishing;
- destructive ChatGPT actions;
- unverified retailer scraping or stock claims;
- silent inference from unrelated conversations;
- public signup or a general-purpose multi-tenant SaaS product;
- recommendation behavior that cannot explain its inputs;
- automation that changes state without reliable observation, audit history, and appropriate notification.

## Decision hierarchy

When sources disagree, use this order:

1. This product vision governs durable product direction.
2. `CONTEXT.md` governs domain terminology.
3. Accepted ADRs and feature specifications govern their bounded decisions.
4. Current code, migrations, tests, and hosted state govern what is actually implemented.
5. The newest dated handoff reports the last verified operational state and must be refreshed against Git and hosted systems before consequential changes.
6. Implementation-plan checkboxes preserve intended execution steps; commits and verification evidence determine completion.

Changing the vision requires an explicit product decision. Changing a feature contract requires updating its specification and affected acceptance criteria. Changing current operational claims requires a new dated handoff rather than rewriting history.
