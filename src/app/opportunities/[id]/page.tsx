import Link from "next/link";
import { notFound } from "next/navigation";

import {
  attachOpportunityAssetAction,
  attachOpportunityProductAction,
  detachOpportunityAssetAction,
  detachOpportunityProductAction,
  editContentOpportunityAction,
  setOpportunityArchivedAction,
  uploadOpportunityAssetAction,
} from "@/app/actions";
import { Notice, SetupNotice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { createBrainService } from "@/lib/brain";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";
type RecordValue = Record<string, unknown>;
type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
function records(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}
function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function OpportunityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  let opportunity: RecordValue | null;
  let options;
  try {
    const brain = createBrainService();
    [opportunity, options] = await Promise.all([
      brain.getOpportunityContext(id),
      brain.getFormOptions(),
    ]);
  } catch (error) {
    return <div className="page-shell"><SetupNotice message={error instanceof Error ? error.message : "Content opportunity could not load."} /></div>;
  }
  if (!opportunity) notFound();

  const productJoins = records(opportunity.content_opportunity_products);
  const assetJoins = records(opportunity.content_opportunity_assets);
  const posts = records(opportunity.posts).sort((a, b) =>
    text(b.published_at).localeCompare(text(a.published_at)),
  );
  const attachedProductIds = new Set(productJoins.map((join) => text(record(join.products).id)));
  const attachedAssetIds = new Set(assetJoins.map((join) => text(record(join.assets).id)));
  const availableProducts = options.products.filter((item) => !attachedProductIds.has(item.id));
  const availableAssets = options.assets.filter((item) => !attachedAssetIds.has(item.id));
  const success = Array.isArray(query.success) ? query.success[0] : query.success;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <div className="page-shell product-shell">
      <header className="product-header">
        <div>
          <Link className="back-link" href="/library">← Backlog</Link>
          <span className="eyebrow">{humanize(text(opportunity.content_type))} · {humanize(text(opportunity.status))}</span>
          <h1>{text(opportunity.title)}</h1>
          <p>{text(opportunity.next_action) ? `Next: ${text(opportunity.next_action)}` : "No next step recorded."}</p>
        </div>
        <div className="header-actions"><Link className="button" href={`/record-post?opportunity=${id}`}>Record post</Link><a className="button button-quiet" href="#edit-opportunity">Edit</a><form action={setOpportunityArchivedAction}><input type="hidden" name="opportunity_id" value={id} /><input type="hidden" name="archived" value={opportunity.archived_at ? "false" : "true"} /><button className="text-button header-text-button" type="submit">{opportunity.archived_at ? "Restore" : "Archive"}</button></form></div>
      </header>
      <Notice success={success} error={error} />

      <div className="opportunity-summary">
        <div><small>Stage</small><strong>{humanize(text(opportunity.status))}</strong></div>
        <div><small>Effort remaining</small><strong>{opportunity.estimated_minutes_remaining === null ? "Automatic" : `${text(opportunity.estimated_minutes_remaining)} min`}</strong></div>
        <div><small>Prepared assets</small><strong>{assetJoins.length}</strong></div>
        <div><small>Destinations reached</small><strong>{new Set(posts.map((post) => text(post.destination_id))).size}</strong></div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <div className="section-heading"><span>01</span><h2>Products & links</h2></div>
            {productJoins.length ? <div className="stack-list">{productJoins.map((join) => {
              const product = record(join.products);
              const listings = records(product.listings);
              const links = listings.flatMap((listing) => records(listing.affiliate_links));
              const primary = listings.find((listing) => listing.is_primary) ?? listings[0];
              return <article className="stack-row opportunity-stack-row" key={text(product.id)}><div><strong><Link href={`/products/${text(product.id)}`}>{text(product.name)}</Link></strong><span>{humanize(text(join.role))}</span></div><div><span>{primary ? `${text(primary.retailer)} · ${humanize(text(primary.stock_status))}` : "No listing"}</span><strong>{primary ? formatMoney(primary.current_price === null ? null : Number(primary.current_price), text(primary.currency) || "USD") : "Product facts pending"}</strong></div><div className="chip-row">{links.filter((link) => link.is_active).map((link) => <span className="chip" key={text(link.id)}>{text(link.network)} ready</span>)}</div><form action={detachOpportunityProductAction}><input type="hidden" name="opportunity_id" value={id} /><input type="hidden" name="product_id" value={text(product.id)} /><button className="text-button" type="submit">Remove</button></form></article>;
            })}</div> : <p className="muted">No products attached. That is fine while this is still an idea.</p>}
            <details className="inline-editor"><summary>Attach a product</summary>{availableProducts.length ? <form action={attachOpportunityProductAction} className="compact-form"><input type="hidden" name="opportunity_id" value={id} /><label>Product<select name="product_id">{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Role<select name="role" defaultValue={productJoins.length ? "supporting" : "primary"}><option value="primary">Primary</option><option value="supporting">Supporting</option><option value="comparison">Comparison</option></select></label><SubmitButton>Attach product</SubmitButton></form> : <p className="muted">Every catalog product is already attached. <Link href="/products/new">Add another product.</Link></p>}</details>
          </section>

          <section className="detail-section">
            <div className="section-heading"><span>02</span><h2>Prepared assets</h2></div>
            {assetJoins.length ? <div className="asset-grid">{assetJoins.map((join) => { const asset = record(join.assets); return <article className="asset-item" key={text(asset.id)}><div className="asset-placeholder">{humanize(text(asset.asset_type))}</div><strong>{text(asset.title) || "Untitled asset"}</strong><span>{humanize(text(join.role))}</span><form action={detachOpportunityAssetAction}><input type="hidden" name="opportunity_id" value={id} /><input type="hidden" name="asset_id" value={text(asset.id)} /><button className="text-button" type="submit">Remove</button></form></article>; })}</div> : <p className="muted">No prepared assets are attached yet.</p>}
            <details className="inline-editor"><summary>Attach an existing asset</summary>{availableAssets.length ? <form action={attachOpportunityAssetAction} className="compact-form"><input type="hidden" name="opportunity_id" value={id} /><label>Asset<select name="asset_id">{availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title ?? asset.asset_type}</option>)}</select></label><label>Role<select name="role" defaultValue={assetJoins.length ? "supporting" : "primary"}><option value="primary">Primary</option><option value="supporting">Supporting</option><option value="comparison">Comparison</option></select></label><SubmitButton>Attach asset</SubmitButton></form> : <p className="muted">No other assets are available. Upload a new one below.</p>}</details>
            <details className="inline-editor"><summary>Upload a new asset</summary><form action={uploadOpportunityAssetAction} className="compact-form"><input type="hidden" name="opportunity_id" value={id} /><label>File<input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" required /></label><label>Title<input name="title" /></label><label>Source<select name="source" defaultValue="home"><option value="home">Home</option><option value="in_store">In store</option><option value="canva">Canva</option><option value="web">Web</option><option value="other">Other</option></select></label><SubmitButton>Upload asset</SubmitButton></form></details>
          </section>

          <section className="detail-section">
            <div className="section-heading"><span>03</span><h2>Distribution history</h2></div>
            {posts.length ? <div className="timeline">{posts.map((post) => { const destination = record(post.destinations); return <article key={text(post.id)}><time>{formatDateTime(text(post.published_at))}</time><div><strong>{text(destination.name) || "Unknown destination"}</strong><p>{text(post.angle) || text(post.caption) || "No caption or angle recorded."}</p><span className="chip">{humanize(text(post.performance_label))}</span></div></article>; })}</div> : <p className="muted">Never published. When this goes to several destinations, they will appear here under one content idea.</p>}
          </section>
        </div>

        <aside className="detail-aside">
          <section className="aside-section"><span className="eyebrow">Working note</span><p>{text(opportunity.notes) || "No note yet."}</p></section>
          <section className="aside-section opportunity-readiness"><span className="eyebrow">Readiness</span><h2>{assetJoins.length ? "Creative started" : "Creative pending"}</h2><p>{productJoins.length ? `${productJoins.length} product${productJoins.length === 1 ? "" : "s"} connected.` : "Add products only when they help."}</p></section>
        </aside>
      </div>

      <section className="detail-section" id="edit-opportunity">
        <div className="section-heading"><span>04</span><h2>Edit content</h2></div>
        <form action={editContentOpportunityAction} className="compact-form">
          <input type="hidden" name="id" value={id} />
          <label className="span-2">Title<input name="title" required defaultValue={text(opportunity.title)} /></label>
          <label>Stage<select name="status" defaultValue={text(opportunity.status)}>{posts.length ? <><option value="posted">Posted</option><option value="revival_candidate">Revival candidate</option></> : <><option value="idea">Idea</option><option value="needs_assets">Needs assets</option><option value="needs_links">Needs links</option><option value="needs_caption">Needs caption</option><option value="ready">Ready</option></>}</select></label>
          <label>Content type<select name="content_type" defaultValue={text(opportunity.content_type)}><option value="unspecified">Not sure yet</option><option value="comparison">Comparison / dupe</option><option value="in_store_find">In-store find</option><option value="styled_at_home">Styled at home</option><option value="sale_restock">Sale / restock</option><option value="collection_roundup">Collection / roundup</option><option value="standalone_product">Standalone product</option><option value="lifestyle_shop_the_look">Lifestyle / shop the look</option><option value="recommendation_response">Recommendation / response</option></select></label>
          <label>Media<select name="media_format" defaultValue={text(opportunity.media_format)}><option value="">Not decided</option><option value="single_image">Single image</option><option value="carousel">Carousel</option><option value="canva_graphic">Canva graphic</option><option value="reel_video">Reel / video</option><option value="other">Other</option></select></label>
          <label>Minutes remaining<input name="estimated_minutes_remaining" type="number" min="0" max="480" defaultValue={text(opportunity.estimated_minutes_remaining)} /></label>
          <label className="span-2">Next action<input name="next_action" defaultValue={text(opportunity.next_action)} /></label>
          <label className="span-2">Notes<textarea name="notes" rows={3} defaultValue={text(opportunity.notes)} /></label>
          <SubmitButton>Save content</SubmitButton>
        </form>
      </section>
    </div>
  );
}
