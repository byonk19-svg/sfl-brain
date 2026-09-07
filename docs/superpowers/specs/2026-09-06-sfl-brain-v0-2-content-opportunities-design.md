# SFL Brain v0.2 — Content Opportunities Design

## Product correction

SFL Brain remains a factual product/listing/asset/post database, but the editorial center becomes a Content Opportunity. Products are attached facts inside an opportunity, not the unit Elaine must mentally manage. An opportunity can be captured with only a title, stage, type, and optional note; products and assets are allowed to arrive later.

The chosen architecture is additive and normalized. Replacing products would discard useful retailer and affiliate structure. Storing a denormalized content snapshot would make link, stock, and asset facts drift. A first-class opportunity plus small join tables preserves the v0.1 foundation while giving posts one editorial parent.

## Data model

`content_opportunities` contains:

- UUID, workspace, title, notes, and next action
- stage: `idea`, `needs_assets`, `needs_links`, `needs_caption`, `ready`, `posted`, or `revival_candidate`
- content type: comparison, in-store find, styled-at-home, sale/restock, collection/roundup, standalone product, lifestyle/shop-the-look, recommendation/response, or reel/video
- optional media format
- optional explicit minutes remaining
- created/updated timestamps and optional `archived_at`

`content_opportunity_products` attaches zero or more products with `primary`, `supporting`, or `comparison` roles. `content_opportunity_assets` attaches the assets prepared for this specific piece. `posts.content_opportunity_id` gives many destination publications one editorial parent. Composite foreign keys and triggers enforce that every relationship remains inside one workspace.

Posted is a lifecycle fact, not a checkbox. The record-post transaction requires an opportunity, derives its products when needed, links the post, and sets the opportunity to `posted`. If the final linked post is later deleted or moved, a database trigger returns `posted` to `ready`. A posted opportunity becomes a Today revival candidate when attached products have an active Radar event, even if its stored stage remains `posted`; `revival_candidate` also permits an explicit editorial revival. Archived opportunities never rank.

## Recommendation model

The pure TypeScript engine ranks opportunities. It keeps v0.1 product facts—availability, affiliate readiness, Radar signals—and combines them with explicit content readiness, opportunity-specific assets, publication history, effort, and variety.

Default stage effort is 5 minutes for ready, 10 for needs-caption or revival, 15 for needs-links, and 30 for needs-assets or idea. An explicit estimate overrides the default. Ready and needs-caption receive the largest readiness bonuses. Posted opportunities are excluded unless they have a revival signal. An opportunity whose attached products are all unavailable or inactive is suppressed; opportunities with no product are valid backlog entries.

Variety looks at the five most recently published distinct opportunities, using the latest destination publication for each opportunity. Multiple cross-post rows therefore count once. A candidate receives no variety penalty for zero or one recent occurrence of its content type, then a soft eight-point penalty per additional occurrence, capped at 24 points. Strong restock, sale, performance, or readiness signals can outweigh it. Every factor emits a matching reason and scores remain deterministic with stable tie-breaking.

Filters are Best Next Post, 5 minutes, 15 minutes, Closest to Done, No New Pictures, and Revive Something. Closest to Done sorts by effort before score; Revive filters to revival candidates.

## UI

The existing quiet editorial visual system remains. `/add` becomes the 10–20 second Add Content flow: title, stage, content type, and optional note. Product administration moves to `/products/new` and remains reachable from the Product Catalog view.

`/library` defaults to the Content Backlog with stage, type, next action, effort, attached product count, asset count, and last publication. A Product Catalog toggle preserves product search and administration. `/opportunities/[id]` shows and edits the opportunity, attaches existing products/assets, shows link readiness, Radar context, distinct destination history, and starts Record Post with the opportunity preselected.

Record Post requires a content opportunity and one destination. Product joins are derived from the opportunity in the database transaction, preventing cross-posts from becoming separate content ideas. The same opportunity can be recorded repeatedly to different destinations.

## MCP compatibility

The five read-only MCP tool names remain unchanged. `get_today_candidates` returns opportunity candidates. `search_sfl_library` searches both opportunities and products. Product context includes related opportunities; recent posts include their opportunity; revival events include affected opportunities. All tools keep text plus structured output and their read-only/closed-world annotations.

## Seed and acceptance

The seed adds the ten named Elaine-style opportunities from the review, including two destination posts for one Antonia comparison. Acceptance proves:

1. Add Content can save an idea without a product.
2. Needs-caption opportunities outrank unfinished photo work for a ten-minute/no-new-pictures request.
3. Cross-posting one comparison twice counts as one item in recent mix.
4. Recording a post changes one opportunity to posted and removes it from normal Today results.
5. A Radar-backed posted opportunity remains eligible as a revival.
6. UI and MCP return the same opportunity ranking.

Retailer monitoring, scraping, recognition, integrations, notifications, authentication, analytics expansion, and visual redesign remain out of scope.
