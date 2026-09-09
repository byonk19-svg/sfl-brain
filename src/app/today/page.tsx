import Link from "next/link";

import { Notice, SetupNotice } from "@/components/notice";
import { createBrainService } from "@/lib/brain";
import { formatDate, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filter = param(query.filter) ?? "best";
  const showAll = param(query.show) === "all";
  const filters =
    filter === "5"
      ? { max_effort_minutes: 5 }
      : filter === "15"
        ? { max_effort_minutes: 15 }
        : filter === "no-photos"
          ? { no_new_photos: true }
          : filter === "closest"
            ? { sort: "closest_to_done" as const }
            : filter === "revive"
              ? { candidate_type: "revival" as const }
              : {};

  let candidates;
  try {
    candidates = await createBrainService().getTodayCandidates({
      ...filters,
      limit: 20,
    });
  } catch (error) {
    return (
      <div className="page-shell">
        <PageHeader />
        <SetupNotice message={error instanceof Error ? error.message : "The database could not be reached."} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader />
      <Notice success={param(query.success)} error={param(query.error)} />
      <div className="filter-bar" aria-label="Recommendation filters">
        {[
          ["best", "Best next post"],
          ["5", "5 minutes"],
          ["15", "15 minutes"],
          ["closest", "Closest to done"],
          ["no-photos", "No new pictures"],
          ["revive", "Revive something"],
        ].map(([value, label]) => (
          <Link className={filter === value ? "filter active" : "filter"} href={`/today?filter=${value}`} key={value}>
            {label}
          </Link>
        ))}
      </div>

      {candidates.length ? (
        <>
        <ol className="candidate-list">
          {(showAll ? candidates : candidates.slice(0, 3)).map((candidate, index) => (
            <li className="candidate" key={candidate.opportunity_id}>
              <div className="rank" aria-label={`Rank ${index + 1}`}>{String(index + 1).padStart(2, "0")}</div>
              <div className="candidate-body">
                <div className="candidate-heading">
                  <div>
                    <span className={`candidate-type ${candidate.candidate_type}`}>{humanize(candidate.content_type)} · {humanize(candidate.status)}</span>
                    <h2><Link href={`/opportunities/${candidate.opportunity_id}`}>{candidate.title}</Link></h2>
                  </div>
                  <span className="effort">Est. {candidate.estimated_effort_minutes} min</span>
                </div>
                <div className="facts">
                  <span>{candidate.product_summary.length ? candidate.product_summary.map((product) => product.name).join(" + ") : "No product needed yet"}</span>
                  <span>{candidate.asset_summary.total} prepared asset{candidate.asset_summary.total === 1 ? "" : "s"}</span>
                  <span>{candidate.link_summary.active} active link{candidate.link_summary.active === 1 ? "" : "s"}</span>
                  {candidate.next_action && <span>Next: {candidate.next_action}</span>}
                </div>
                <ul className="reason-list">
                  {candidate.reasons
                    .filter((reason) => reason.points > 0)
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 4)
                    .map((reason) => <li key={reason.code}>{reason.label}</li>)}
                </ul>
                {candidate.reasons.some((reason) => reason.points < 0) && <p className="candidate-caution">Caution: {candidate.reasons.filter((reason) => reason.points < 0).map((reason) => reason.label).join(" · ")}</p>}
                <div className="candidate-foot">
                  <span>Last published: {formatDate(candidate.last_published_at)}{candidate.publication_summary.destination_count > 1 ? ` · ${candidate.publication_summary.destination_count} destinations` : ""}</span>
                  <details><summary>Score details</summary><p>{candidate.score} points · {candidate.reasons.map((reason) => `${reason.label} ${reason.points > 0 ? "+" : ""}${reason.points}`).join(" · ")}</p></details>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {candidates.length > 3 && <Link className="button button-quiet" href={showAll ? "/today" : `/today?filter=${filter}&show=all`}>{showAll ? "Show top three" : `Show ${candidates.length - 3} more`}</Link>}
        </>
      ) : (
        <section className="empty-state"><h2>No content matches this filter.</h2><p>Constraints were not relaxed. See the closest options or capture the next idea.</p><Link className="button" href="/today?filter=closest">See closest options</Link> <Link className="button button-quiet" href="/add">Add content</Link></section>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <header className="page-header hero-header">
      <div><span className="eyebrow">Today · {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span><h1>What should I post today?</h1></div>
      <Link className="button button-quiet" href="/add">Capture an idea</Link>
    </header>
  );
}
