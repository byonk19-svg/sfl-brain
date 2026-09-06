import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addAffiliateLinkAction,
  addListingAction,
  addRadarEventAction,
  editProductAction,
  uploadAssetAction,
} from "@/app/actions";
import { Notice, SetupNotice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { createBrainService } from "@/lib/brain";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";

/* eslint-disable @next/next/no-img-element -- private signed Storage URLs are intentionally rendered without an external optimizer */

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function records(value: unknown): RecordValue[] { return Array.isArray(value) ? value.map(record) : []; }
function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function localDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  let product: RecordValue | null;
  try { product = await createBrainService().getProductContext(id); }
  catch (error) { return <div className="page-shell"><SetupNotice message={error instanceof Error ? error.message : "Product context could not load."} /></div>; }
  if (!product) notFound();

  const listings = records(product.listings);
  const assetJoins = records(product.asset_products);
  const assets = assetJoins.map((join) => {
    const asset = record(join.assets);
    return { ...asset, role: join.role } as RecordValue;
  });
  const postJoins = records(product.post_products);
  const posts = postJoins.map((join) => record(join.posts)).sort((a, b) => text(b.published_at).localeCompare(text(a.published_at)));
  const radarEvents = records(product.radar_events).sort((a, b) => text(b.happened_at).localeCompare(text(a.happened_at)));
  const success = Array.isArray(query.success) ? query.success[0] : query.success;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <div className="page-shell product-shell">
      <header className="product-header">
        <div><Link className="back-link" href="/library">← Library</Link><span className="eyebrow">{text(product.category) || "Uncategorized"} · {humanize(text(product.lifecycle_status))}</span><h1>{text(product.name)}</h1><p>{text(product.brand) || "Brand not recorded"} · {humanize(text(product.experience_level))}</p></div>
        <div className="header-actions"><Link className="button" href={`/record-post?product=${id}`}>Record post</Link><a className="button button-quiet" href="#edit-product">Edit</a></div>
      </header>
      <Notice success={success} error={error} />

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section"><div className="section-heading"><span>01</span><h2>Listings & links</h2></div>
            {listings.length ? <div className="stack-list">{listings.map((listing) => <article className="stack-row" key={text(listing.id)}><div><strong>{text(listing.retailer)}</strong><a href={text(listing.canonical_url)} target="_blank" rel="noreferrer">View demo listing ↗</a></div><div><span>{humanize(text(listing.stock_status))}</span><strong>{formatMoney(listing.current_price === null ? null : Number(listing.current_price), text(listing.currency) || "USD")}</strong></div><div className="chip-row">{records(listing.affiliate_links).map((link) => <a className="chip" href={text(link.url)} target="_blank" rel="noreferrer" key={text(link.id)}>{text(link.network)} ↗</a>)}</div></article>)}</div> : <p className="muted">No retailer listing yet.</p>}
            <details className="inline-editor"><summary>Add listing</summary><form action={addListingAction} className="compact-form"><input type="hidden" name="product_id" value={id} /><label>Retailer<input name="retailer" required /></label><label>URL<input name="canonical_url" type="url" required /></label><label>Variant<input name="variant_label" /></label><label>Price<input name="current_price" type="number" min="0" step="0.01" /></label><label>Stock<select name="stock_status" defaultValue="unknown"><option value="unknown">Unknown</option><option value="in_stock">In stock</option><option value="limited">Limited</option><option value="out_of_stock">Out of stock</option></select></label><label className="check"><input name="is_primary" type="checkbox" /> Primary listing</label><SubmitButton>Add listing</SubmitButton></form></details>
            {listings.length > 0 && <details className="inline-editor"><summary>Add affiliate link</summary><form action={addAffiliateLinkAction} className="compact-form"><input type="hidden" name="product_id" value={id} /><label>Listing<select name="listing_id" required>{listings.map((listing) => <option value={text(listing.id)} key={text(listing.id)}>{text(listing.retailer)}</option>)}</select></label><label>Network<input name="network" required placeholder="later_creator" /></label><label>Affiliate URL<input name="url" required type="url" /></label><SubmitButton>Add link</SubmitButton></form></details>}
          </section>

          <section className="detail-section"><div className="section-heading"><span>02</span><h2>Assets</h2></div>
            {assets.length ? <div className="asset-grid">{assets.map((asset) => <article className="asset-item" key={text(asset.id)}>{asset.signed_url && text(asset.asset_type) !== "video" ? <img src={text(asset.signed_url)} alt={text(asset.title) || "Product asset"} /> : <div className="asset-placeholder">{humanize(text(asset.asset_type))}</div>}<strong>{text(asset.title) || text(asset.original_filename) || "Untitled asset"}</strong><span>{humanize(text(asset.source))} · {humanize(text(asset.role))}</span></article>)}</div> : <p className="muted">No assets yet. This product will require new content.</p>}
            <details className="inline-editor"><summary>Upload private asset</summary><form action={uploadAssetAction} className="compact-form"><input type="hidden" name="product_id" value={id} /><label>File<input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" required /></label><label>Title<input name="title" /></label><label>Source<select name="source" defaultValue="home"><option value="home">Home</option><option value="in_store">In store</option><option value="canva">Canva</option><option value="web">Web</option><option value="other">Other</option></select></label><SubmitButton>Upload asset</SubmitButton></form></details>
          </section>

          <section className="detail-section"><div className="section-heading"><span>03</span><h2>Post history</h2></div>
            {posts.length ? <div className="timeline">{posts.map((post) => { const destination = record(post.destinations); return <article key={text(post.id)}><time>{formatDateTime(text(post.published_at))}</time><div><strong>{text(destination.name) || "Unknown destination"}</strong><p>{text(post.angle) || text(post.caption) || "No caption or angle recorded."}</p><span className="chip">{humanize(text(post.performance_label))}</span>{records(post.post_metrics).map((metric) => <span className="metric" key={text(metric.id)}>{text(metric.views)} views · {text(metric.clicks)} clicks · {text(metric.sales)} sales</span>)}</div></article>; })}</div> : <p className="muted">No posts recorded yet.</p>}
          </section>
        </div>

        <aside className="detail-aside">
          <section className="aside-section"><span className="eyebrow">Revival Radar</span><h2>{radarEvents.filter((event) => !event.dismissed_at).length} signal{radarEvents.filter((event) => !event.dismissed_at).length === 1 ? "" : "s"}</h2>{radarEvents.map((event) => <div className="radar-row" key={text(event.id)}><strong>{humanize(text(event.event_type))}</strong><span>{formatDateTime(text(event.happened_at))}</span>{event.expires_at !== null && event.expires_at !== undefined && <small>Expires {formatDateTime(text(event.expires_at))}</small>}</div>)}
            <details className="inline-editor"><summary>Add Radar event</summary><form action={addRadarEventAction} className="compact-form single-column"><input type="hidden" name="product_id" value={id} /><label>Signal<select name="event_type"><option value="restock">Restock</option><option value="price_drop">Price drop</option><option value="sale">Sale</option><option value="seasonal">Seasonal</option><option value="manual_trend">Manual trend</option><option value="commission_boost">Commission boost</option></select></label><label>Listing<select name="listing_id" defaultValue=""><option value="">Product-level</option>{listings.map((listing) => <option value={text(listing.id)} key={text(listing.id)}>{text(listing.retailer)}</option>)}</select></label><label>Happened at<input name="happened_at" type="datetime-local" required defaultValue={localDateTime()} /></label><label>Expires at<input name="expires_at" type="datetime-local" /></label><SubmitButton>Add signal</SubmitButton></form></details>
          </section>
          <section className="aside-section"><span className="eyebrow">Notes</span><p>{text(product.notes) || "No notes yet."}</p><div className="chip-row">{(Array.isArray(product.tags) ? product.tags : []).map((tag) => <span className="chip" key={text(tag)}>{text(tag)}</span>)}</div></section>
        </aside>
      </div>

      <section className="detail-section" id="edit-product"><div className="section-heading"><span>04</span><h2>Edit product</h2></div><form action={editProductAction} className="compact-form"><input type="hidden" name="id" value={id} /><label>Name<input name="name" required defaultValue={text(product.name)} /></label><label>Brand<input name="brand" defaultValue={text(product.brand)} /></label><label>Category<input name="category" defaultValue={text(product.category)} /></label><label>Status<select name="lifecycle_status" defaultValue={text(product.lifecycle_status)}><option value="active">Active</option><option value="discontinued">Discontinued</option><option value="archived">Archived</option></select></label><label>Experience<select name="experience_level" defaultValue={text(product.experience_level)}><option value="online_only">Online only</option><option value="seen_in_store">Seen in store</option><option value="handled_in_store">Handled in store</option><option value="owned">Owned</option><option value="used_at_home">Used at home</option></select></label><label>Tags<input name="tags" defaultValue={(Array.isArray(product.tags) ? product.tags : []).join(", ")} /></label><label className="span-2">Notes<textarea name="notes" rows={3} defaultValue={text(product.notes)} /></label><SubmitButton>Save changes</SubmitButton></form></section>
    </div>
  );
}
