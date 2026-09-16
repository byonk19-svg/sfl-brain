# SFL Brain Domain Language

## Post Package

One versioned publishing cycle beneath a Content Opportunity, containing the copy and creative prepared for that cycle. A revival creates a new Post Package; a package already used for publication remains preserved rather than being overwritten.

## Base caption

The source copy within a Post Package from which destination or audience variations are initially created. Changing it does not silently alter variants that have already been created.

## Caption variant

An independently editable copy version created from a Post Package's Base caption for a particular destination or audience. It begins as a snapshot rather than maintaining live inheritance.

## Audience variant

A Caption variant intended for reuse across destinations with the same audience pattern, such as SFL groups or personal-profile groups.

## Destination override

An optional Caption variant for one exact destination whose rules or audience require copy different from its normal Audience variant.

## Package asset selection

A Post Package's ordered use of an existing Asset, including the asset's package-specific role. The underlying file remains reusable, while each publication preserves the exact selection and order it used.

## Post Package lifecycle

A Post Package moves from Draft to Publishing when its first publication is recorded, then to Closed when that publishing cycle is intentionally complete. Closed packages are preserved; later execution begins in a new Post Package.

## Active Post Package

The single Draft or Publishing Post Package currently being prepared beneath a Content Opportunity. A new package may begin only after the prior active package is Closed or Abandoned.

## Abandoned Post Package

A terminal Post Package that was intentionally stopped before any publication occurred. It remains preserved but does not represent a completed publishing cycle.

## Approved caption variant

A Caption variant explicitly marked ready for use in a publication. Draft variants may be revised but cannot be selected as the copy for a planned publication.

## Distribution item

One intended exact destination within a Post Package, linked to its chosen Audience variant or Destination override. It is Planned until a publication is recorded, or Skipped when deliberately omitted.

## Distribution plan

The collection of a Post Package's Distribution items. A package may be closed manually only after every item is Published or Skipped.

## Publication

The durable record of one actual post to one exact Destination. It snapshots the approved caption and ordered assets used from its Post Package so later package changes cannot rewrite published history.

## Connector member

An SFL Brain member who authorizes ChatGPT to access SFL Brain on their behalf. Connector access is tied to the member's existing SFL Brain identity and is limited to workspaces where that member has an explicit membership. It is not a shared machine or service identity.

## Conversational editing

The ability for a connector member to create or change SFL Brain records through ChatGPT, with the resulting state reflected in the website. Conversational editing is subject to the same workspace authorization and business rules as editing through the website.

## Initial conversational editing scope

The hosted connector supports saving a content opportunity, updating its editorial progress, recording a publication that already happened, and managing its hold state. Product administration, retailer listings, affiliate links, Radar events, asset management, relationship management, and archiving remain website-only until the hosted connector boundary is proven.

## Confirmed connector write

A conversational edit that ChatGPT has described to the connector member and the member has explicitly approved before execution. Every hosted connector write in the initial release must be a confirmed connector write.

## Connector mutation record

The durable audit record for a confirmed connector write. It identifies the authenticated connector member, authorized workspace, connector source, action, request identity, outcome, and timestamp. It does not retain the member's ChatGPT conversation.

## Non-destructive conversational editing

The initial hosted connector may add content opportunities, correct their editable progress fields, and record publications. It does not delete opportunities, publications, or related records. Destructive corrections remain website-only until explicit recovery behavior is defined.

## Production connector

The always-available, OAuth-protected SFL Brain MCP service hosted independently of any member's computer. It is the connector Elaine uses from ChatGPT.

## Development tunnel

An optional private path from supported OpenAI products to a developer's local SFL Brain server for pre-deployment testing. Its availability never determines whether the production connector works.

## On-hold opportunity

A retained content opportunity that should not compete for current editorial attention. It is excluded from the active Content backlog and Today recommendations, but remains accessible in the separate On hold view until it is released.

## Hold release condition

The factual condition that would make an on-hold opportunity worth reconsidering, such as a retailer becoming commissionable through an available affiliate channel. A release condition is advisory until SFL Brain can independently monitor every relevant dependency. Meeting it does not automatically release the opportunity; a connector member must release it manually.

An opportunity's hold state is independent of its editorial stage. Placing an opportunity on hold preserves whether it is an Idea, Needs assets, Needs links, Needs caption, Ready, Posted, or a Revival candidate; manual release returns it to active attention at that same stage.

## Hold period

One continuous interval during which an opportunity is on hold. A hold period retains its reason, release condition, optional review date, who placed the hold, when it began, and—after release—who released it and when. Releasing a hold ends the current period rather than erasing it; placing the same opportunity on hold later starts a new period.

## Hold reason

The current blocker that explains why an opportunity should not receive editorial attention now. It is distinct from the release condition, which describes what must become true before the opportunity is worth reconsidering.

## Hold review date

An optional date when an on-hold opportunity becomes due for reconsideration. During the manual-release phase, reaching this date flags the opportunity for review but does not release it.

An on-hold opportunity that is due for review remains on hold and excluded from active recommendations. Within the On hold view, due items precede upcoming review dates, and undated holds follow date-based holds.

## Monitored release condition

A future release condition whose truth SFL Brain can establish from an authorized conversation or a trusted external source. Once monitoring is supported for every dependency in that condition, satisfying it may release the opportunity automatically and must notify the connector member that the hold was removed.

An authorized conversation satisfies a monitored release condition only when the connector member makes an explicit factual statement while SFL Brain Hosted is active. Statements of intent, application, expectation, possibility, or speculation do not establish that the condition is true. Automated hold changes remain outside the current manual On hold release.

## Active backlog

The content opportunities currently eligible for editorial attention. On-hold and archived opportunities are not part of the active backlog. An on-hold opportunity remains discoverable through an explicit search or direct lookup, where its hold state and release condition must be shown.

## Manual hold release

An explicit connector-member decision that ends the current hold period and returns the opportunity to the active backlog at its preserved editorial stage. A manual release gives immediate confirmation to the member who performed it but does not send a separate notification; notifications are reserved for future automatic changes.

During the manual-release phase, placing or releasing a hold produces immediate on-screen confirmation but no separate notification. Proactive notification belongs to future automatic release, when a hold can change without the connector member being present.
