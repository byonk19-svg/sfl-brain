import Link from "next/link";

import { Notice, SetupNotice } from "@/components/notice";
import { createBrainService } from "@/lib/brain";
import { formatDate, formatMoney, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filter = param(query.filter) ?? "best";
  const filters =
    filter === "5"
      ? { max_effort_minutes: 5 }
      : filter === "15"
        ? { max_effort_minutes: 15 }
        : filter === "no-photos"
          ? { no_new_photos: true }
          : {};

  let candidates;
  try {
    candidates = await createBrainService().getTodayCandidates({ ...filters, limit: 20 });
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
          ["best", "Best opportunities"],
          ["5", "5 minutes"],
          ["15", "15 minutes"],
          ["no-photos", "No new photos"],
        ].map(([value, label]) => (
          <Link className={filter === value ? "filter active" : "filter"} href={`/today?filter=${value}`} key={value}>
            {label}
          </Link>
        ))}
      </div>

      {candidates.length ? (
        <ol className="candidate-list">
          {candidates.map((candidate, index) => (
            <li className="candidate" key={candidate.product_id}>
              <div className="rank" aria-label={`Rank ${index + 1}`}>{String(index + 1).padStart(2, "0")}</div>
              <div className="candidate-body">
                <div className="candidate-heading">
                  <div>
                    <span className={`candidate-type ${candidate.candidate_type}`}>{humanize(candidate.candidate_type)}</span>
                    <h2><Link href={`/products/${candidate.product_id}`}>{candidate.name}</Link></h2>
                  </div>
                  <span className="effort">{candidate.estimated_effort_minutes} min</span>
                </div>
                <div className="facts">
                  <span>{candidate.primary_listing ? candidate.primary_listing.retailer : "No listing"}</span>
                  <span>{candidate.primary_listing ? humanize(candidate.primary_listing.stock_status) : "Stock unknown"}</span>
                  <span>{candidate.primary_listing ? formatMoney(candidate.primary_listing.current_price, candidate.primary_listing.currency) : "Price unknown"}</span>
                  <span>{candidate.asset_summary.total} asset{candidate.asset_summary.total === 1 ? "" : "s"}</span>
                </div>
                <ul className="reason-list">
                  {candidate.reasons
                    .filter((reason) => reason.points > 0)
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 4)
                    .map((reason) => <li key={reason.code}>{reason.label}</li>)}
                </ul>
                <div className="candidate-foot">
                  <span>Last posted: {formatDate(candidate.last_posted_at)}</span>
                  <details><summary>Score details</summary><p>{candidate.score} points · {candidate.reasons.map((reason) => `${reason.label} ${reason.points > 0 ? "+" : ""}${reason.points}`).join(" · ")}</p></details>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <section className="empty-state"><h2>No opportunities match this filter.</h2><p>Try Best opportunities, or add a product and asset to the Library.</p></section>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <header className="page-header hero-header">
      <div><span className="eyebrow">Today · {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span><h1>What should I post today?</h1></div>
      <Link className="button button-quiet" href="/record-post">Record a post</Link>
    </header>
  );
}
