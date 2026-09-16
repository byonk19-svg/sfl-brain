import Link from "next/link";

import { recordPostAction } from "@/app/actions";
import { Notice, SetupNotice } from "@/components/notice";
import { PublishedAtInput } from "@/components/published-at-input";
import { SubmitButton } from "@/components/submit-button";
import { humanize } from "@/lib/format";
import type { PostPackage, PostPackageDistributionItem } from "@/lib/post-package";
import { createWebsiteBrainService } from "@/lib/website-auth";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parameter(params: Awaited<SearchParams>, name: string) {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function RecordPostPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedOpportunity = parameter(params, "opportunity");
  const selectedDistribution = parameter(params, "distribution");
  const error = parameter(params, "error") || undefined;
  const loaded = await loadRecordPostData(selectedOpportunity, selectedDistribution).then(
    (data) => ({ data } as const),
    (caught: unknown) => ({ error: caught instanceof Error ? caught.message : "Posting options could not load." } as const),
  );
  if ("error" in loaded) {
    return <div className="page-shell narrow-shell"><Header /><SetupNotice message={loaded.error} /></div>;
  }
  const { options, opportunityAssets, packagePublication } = loaded.data;

  if (packagePublication) {
    return (
      <div className="page-shell narrow-shell">
        <Header />
        <Notice error={error} />
        <PackagePublicationForm {...packagePublication} />
      </div>
    );
  }

  return (
    <div className="page-shell narrow-shell">
      <Header />
      <Notice error={error} />
      <form action={recordPostAction} className="editor-form">
        <section className="form-section"><div className="section-number">01</div><div className="form-section-body"><h2>What went out?</h2><div className="field-grid"><label className="span-2">Content opportunity<select name="content_opportunity_id" required defaultValue={selectedOpportunity}><option value="" disabled>Choose content</option>{options.opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title} · {humanize(opportunity.status)}</option>)}</select></label><label>Destination<select name="destination_id" required defaultValue=""><option value="" disabled>Choose destination</option>{options.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select></label><PublishedAtInput /></div>{!selectedOpportunity && <p className="form-help">Choose the content here, or start from its backlog detail page to preselect prepared assets.</p>}</div></section>
        <section className="form-section"><div className="section-number">02</div><div className="form-section-body"><h2>Post context</h2><div className="field-grid"><label className="span-2">Caption<textarea rows={4} name="caption" /></label><label>Angle<input name="angle" placeholder="small-space styling" /></label><label>Performance<select name="performance_label" defaultValue="unknown"><option value="unknown">Unknown</option><option value="weak">Weak</option><option value="normal">Normal</option><option value="winner">Winner</option></select></label><label className="span-2">Notes<textarea rows={2} name="notes" /></label></div></div></section>
        {selectedOpportunity && <section className="form-section"><div className="section-number">03</div><div className="form-section-body"><h2>Prepared assets used <small>Optional</small></h2>{opportunityAssets.length ? <div className="choice-grid">{opportunityAssets.map((asset) => <label className="choice" key={asset.id}><input type="checkbox" name="asset_ids" value={asset.id} /><span>{asset.title ?? asset.asset_type}</span></label>)}</div> : <p className="muted">No assets are attached to this content opportunity.</p>}</div></section>}
        <div className="form-actions"><Link className="button button-quiet" href="/library">Back to backlog</Link><SubmitButton>Record post</SubmitButton></div>
      </form>
    </div>
  );
}

async function loadRecordPostData(selectedOpportunity: string, selectedDistribution: string) {
  const brain = await createWebsiteBrainService();
  const options = await brain.getFormOptions();
  const selected = options.opportunities.find((opportunity) => opportunity.id === selectedOpportunity);
  const selectedAssetIds = new Set(
    (selected?.content_opportunity_assets ?? []).map((join) => join.asset_id),
  );
  const opportunityAssets = options.assets.filter((asset) => selectedAssetIds.has(asset.id));
  if (!selectedDistribution) return { options, opportunityAssets, packagePublication: null };
  if (!selectedOpportunity) throw new Error("Choose the content opportunity for this publication.");
  const context = await brain.getPostPackageContext(selectedOpportunity);
  const activePackage = context.active_package;
  const item = activePackage?.distribution_items.find((candidate) => candidate.id === selectedDistribution);
  const variant = activePackage?.caption_variants.find((candidate) => candidate.id === item?.caption_variant_id);
  if (!selected || !activePackage || !item || item.status !== "planned" || variant?.status !== "approved") {
    throw new Error("That planned publication is no longer available. Refresh the opportunity and try again.");
  }
  return {
    options,
    opportunityAssets,
    packagePublication: {
      opportunity: { id: selected.id, title: selected.title },
      activePackage,
      item,
      caption: variant.body,
    },
  };
}

function PackagePublicationForm({ opportunity, activePackage, item, caption }: {
  opportunity: { id: string; title: string };
  activePackage: PostPackage;
  item: PostPackageDistributionItem;
  caption: string;
}) {
  return (
    <form action={recordPostAction} className="editor-form">
      <input type="hidden" name="content_opportunity_id" value={opportunity.id} />
      <input type="hidden" name="package_id" value={activePackage.id} />
      <input type="hidden" name="distribution_item_id" value={item.id} />
      <input type="hidden" name="expected_updated_at" value={activePackage.updated_at} />
      <section className="form-section"><div className="section-number">01</div><div className="form-section-body"><h2>Package publication</h2><dl className="detail-grid"><div><dt>Content</dt><dd>{opportunity.title}</dd></div><div><dt>Destination</dt><dd>{item.destination.name}</dd></div><div><dt>Package</dt><dd>Package {activePackage.sequence} · {humanize(activePackage.status)}</dd></div></dl><p className="form-help">Caption, destination, products, and asset order are locked to the approved Post Package snapshot.</p></div></section>
      <section className="form-section"><div className="section-number">02</div><div className="form-section-body"><h2>Approved caption</h2><p className="package-copy">{caption}</p></div></section>
      <section className="form-section"><div className="section-number">03</div><div className="form-section-body"><h2>Ordered assets</h2>{activePackage.assets.length ? <ol>{activePackage.assets.map((selection) => <li key={selection.asset_id}>{selection.asset.title ?? humanize(selection.asset.asset_type)} · {humanize(selection.role)}</li>)}</ol> : <p className="muted">No assets are selected for this package.</p>}<div className="field-grid"><PublishedAtInput /><label className="span-2">Publication notes<textarea rows={2} name="notes" /></label></div></div></section>
      <div className="form-actions"><Link className="button button-quiet" href={`/opportunities/${opportunity.id}`}>Back to opportunity</Link><SubmitButton>Record package publication</SubmitButton></div>
    </form>
  );
}

function Header() { return <header className="page-header"><div><span className="eyebrow">One idea, many destinations</span><h1>Record Post</h1><p>Each destination is one publication row. Reusing the same content opportunity keeps editorial variety accurate.</p></div><Link className="button button-quiet" href="/destinations">Manage destinations</Link></header>; }
