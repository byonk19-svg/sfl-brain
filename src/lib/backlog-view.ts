import type { OpportunityAttentionScope } from "./opportunity-repository";

export type BacklogView = "backlog" | "on-hold";

export function backlogRowClassName(held: boolean) {
  return held ? "backlog-row is-held" : "backlog-row";
}

export function opportunityScopeForBacklogView(
  view: BacklogView,
  query: string,
): OpportunityAttentionScope {
  if (view === "on-hold") return "on_hold";
  return query.trim() ? "all" : "active";
}
