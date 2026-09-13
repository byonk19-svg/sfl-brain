# SFL Brain Domain Language

## Connector member

An SFL Brain member who authorizes ChatGPT to access SFL Brain on their behalf. Connector access is tied to the member's existing SFL Brain identity and is limited to workspaces where that member has an explicit membership. It is not a shared machine or service identity.

## Conversational editing

The ability for a connector member to create or change SFL Brain records through ChatGPT, with the resulting state reflected in the website. Conversational editing is subject to the same workspace authorization and business rules as editing through the website.

## Initial conversational editing scope

The first hosted connector release supports saving a content opportunity, updating its editorial progress, and recording a publication that already happened. Product administration, retailer listings, affiliate links, Radar events, asset management, relationship management, and archiving remain website-only until the hosted connector boundary is proven.

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
