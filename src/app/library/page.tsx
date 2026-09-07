import Link from "next/link";

import { SetupNotice } from "@/components/notice";
import { createBrainService } from "@/lib/brain";
import { formatDate, formatMoney, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params.q);
  const view = param(params.view) === "products" ? "products" : "backlog";
  let rows: Record<string, unknown>[] = [];
  let loadError: string | null = null;
  try {
    const brain = createBrainService();
    rows = view === "backlog"
      ? await brain.searchContentBacklog(q, 100)
      : await brain.searchLibrary(q, 100);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "The Library could not load.";
  }
  return (
    <div className="page-shell">
      <LibraryHeader query={q} view={view} />
      {loadError ? <SetupNotice message={loadError} /> : view === "backlog" ? <Backlog rows={rows} /> : <Products rows={rows} />}
    </div>
  );
}

function LibraryHeader({ query, view }: { query: string; view: "backlog" | "products" }) {
  return (
    <>
      <header className="page-header library-header">
        <div><span className="eyebrow">Content and product memory</span><h1>{view === "backlog" ? "Backlog" : "Products"}</h1></div>
        <form className="search-form" action="/library"><input type="hidden" name="view" value={view} /><label className="sr-only" htmlFor="library-search">Search {view}</label><input id="library-search" name="q" defaultValue={query} placeholder={view === "backlog" ? "Search captions, comparisons, next steps…" : "Search chairs, Walmart, fall…"} /><button type="submit">Search</button></form>
        <Link className="button" href={view === "backlog" ? "/add" : "/products/new"}>{view === "backlog" ? "Add content" : "Add product"}</Link>
      </header>
      <div className="view-switcher" aria-label="Library view"><Link className={view === "backlog" ? "active" : ""} href="/library">Content backlog</Link><Link className={view === "products" ? "active" : ""} href="/library?view=products">Product catalog</Link></div>
    </>
  );
}

function Backlog({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <section className="empty-state"><h2>No backlog matches.</h2><p>Capture the idea now; products can be attached later.</p><Link className="button" href="/add">Add content</Link></section>;
  return <div className="backlog-list" role="list">{rows.map((row) => { const assets = Number(row.assets_count); const links = Number(row.active_links_count); const products = Number(row.products_count); return <Link className="backlog-row" href={`/opportunities/${String(row.id)}`} key={String(row.id)} role="listitem"><div className="backlog-title"><span className="stage-dot" data-stage={String(row.status)} /><div><h2>{String(row.title)}</h2><p>{humanize(String(row.content_type))}</p></div></div><div className="library-fact"><small>Stage</small><span>{humanize(String(row.status))}</span></div><div className="library-fact"><small>Next step</small><span>{row.next_action ? String(row.next_action) : "—"}</span></div><div className="library-fact"><small>Effort</small><span>{String(row.estimated_effort_minutes)} min</span></div><div className="library-fact"><small>Ready pieces</small><span>{assets} asset{assets === 1 ? "" : "s"} · {links} link{links === 1 ? "" : "s"}</span></div><div className="library-status">{row.last_published_at ? `Posted ${formatDate(String(row.last_published_at))}` : `${products} product${products === 1 ? "" : "s"}`}</div></Link>; })}</div>;
}

function Products({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <section className="empty-state"><h2>No products match.</h2><p>Search by product, brand, retailer, or tag.</p></section>;
  return <div className="library-list" role="list">{rows.map((product) => <Link className="library-row" href={`/products/${String(product.id)}`} key={String(product.id)} role="listitem"><div className="library-title"><h2>{String(product.name)}</h2><p>{[product.brand, product.retailer].filter(Boolean).map(String).join(" · ") || "No retailer yet"}</p></div><div className="library-fact"><small>Stock</small><span>{humanize(String(product.stock_status))}</span></div><div className="library-fact"><small>Price</small><span>{formatMoney(product.current_price as number | null, String(product.currency))}</span></div><div className="library-fact"><small>Assets</small><span>{String(product.assets_count)}</span></div><div className="library-fact"><small>Last posted</small><span>{formatDate(product.last_posted_at as string | null)}</span></div><div className="library-status">{product.active_radar_event ? humanize(String(product.active_radar_event)) : humanize(String(product.performance))}</div></Link>)}</div>;
}
