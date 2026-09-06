import Link from "next/link";

import { SetupNotice } from "@/components/notice";
import { createBrainService } from "@/lib/brain";
import { formatDate, formatMoney, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  let products;
  try {
    products = await createBrainService().searchLibrary(q, 100);
  } catch (error) {
    return <div className="page-shell"><PageHeader query={q} /><SetupNotice message={error instanceof Error ? error.message : "The Library could not load."} /></div>;
  }

  return (
    <div className="page-shell">
      <PageHeader query={q} />
      <div className="library-list" role="list">
        {products.map((product) => (
          <Link className="library-row" href={`/products/${String(product.id)}`} key={String(product.id)} role="listitem">
            <div className="library-title"><h2>{String(product.name)}</h2><p>{[product.brand, product.retailer].filter(Boolean).map(String).join(" · ") || "No retailer yet"}</p></div>
            <div className="library-fact"><small>Stock</small><span>{humanize(String(product.stock_status))}</span></div>
            <div className="library-fact"><small>Price</small><span>{formatMoney(product.current_price as number | null, String(product.currency))}</span></div>
            <div className="library-fact"><small>Assets</small><span>{String(product.assets_count)}</span></div>
            <div className="library-fact"><small>Last posted</small><span>{formatDate(product.last_posted_at as string | null)}</span></div>
            <div className="library-status">{product.active_radar_event ? humanize(String(product.active_radar_event)) : humanize(String(product.performance))}</div>
          </Link>
        ))}
      </div>
      {!products.length && <section className="empty-state"><h2>No Library matches.</h2><p>Search by product, brand, retailer, or tag—or add the first one.</p></section>}
    </div>
  );
}

function PageHeader({ query }: { query: string }) {
  return (
    <header className="page-header library-header">
      <div><span className="eyebrow">Everything you know</span><h1>Library</h1></div>
      <form className="search-form" action="/library"><label className="sr-only" htmlFor="library-search">Search Library</label><input id="library-search" name="q" defaultValue={query} placeholder="Search chairs, Walmart, fall…" /><button type="submit">Search</button></form>
      <Link className="button" href="/add">Add product</Link>
    </header>
  );
}
