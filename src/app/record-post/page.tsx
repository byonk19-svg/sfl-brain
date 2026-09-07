import Link from "next/link";

import { recordPostAction } from "@/app/actions";
import { Notice, SetupNotice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { createBrainService } from "@/lib/brain";
import { humanize } from "@/lib/format";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function localDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default async function RecordPostPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedOpportunity = (Array.isArray(params.opportunity) ? params.opportunity[0] : params.opportunity) ?? "";
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  let options;
  try { options = await createBrainService().getFormOptions(); }
  catch (caught) { return <div className="page-shell narrow-shell"><Header /><SetupNotice message={caught instanceof Error ? caught.message : "Posting options could not load."} /></div>; }

  const selected = options.opportunities.find((opportunity) => opportunity.id === selectedOpportunity);
  const selectedAssetIds = new Set(
    (selected?.content_opportunity_assets ?? []).map((join) => join.asset_id),
  );
  const opportunityAssets = options.assets.filter((asset) => selectedAssetIds.has(asset.id));

  return (
    <div className="page-shell narrow-shell">
      <Header />
      <Notice error={error} />
      <form action={recordPostAction} className="editor-form">
        <section className="form-section"><div className="section-number">01</div><div className="form-section-body"><h2>What went out?</h2><div className="field-grid"><label className="span-2">Content opportunity<select name="content_opportunity_id" required defaultValue={selectedOpportunity}><option value="" disabled>Choose content</option>{options.opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title} · {humanize(opportunity.status)}</option>)}</select></label><label>Destination<select name="destination_id" required defaultValue=""><option value="" disabled>Choose destination</option>{options.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select></label><label>Published at<input type="datetime-local" name="published_at" required defaultValue={localDateTime()} /></label></div>{!selectedOpportunity && <p className="form-help">Choose the content here, or start from its backlog detail page to preselect prepared assets.</p>}</div></section>
        <section className="form-section"><div className="section-number">02</div><div className="form-section-body"><h2>Post context</h2><div className="field-grid"><label className="span-2">Caption<textarea rows={4} name="caption" /></label><label>Angle<input name="angle" placeholder="small-space styling" /></label><label>Performance<select name="performance_label" defaultValue="unknown"><option value="unknown">Unknown</option><option value="weak">Weak</option><option value="normal">Normal</option><option value="winner">Winner</option></select></label><label className="span-2">Notes<textarea rows={2} name="notes" /></label></div></div></section>
        {selectedOpportunity && <section className="form-section"><div className="section-number">03</div><div className="form-section-body"><h2>Prepared assets used <small>Optional</small></h2>{opportunityAssets.length ? <div className="choice-grid">{opportunityAssets.map((asset) => <label className="choice" key={asset.id}><input type="checkbox" name="asset_ids" value={asset.id} /><span>{asset.title ?? asset.asset_type}</span></label>)}</div> : <p className="muted">No assets are attached to this content opportunity.</p>}</div></section>}
        <div className="form-actions"><Link className="button button-quiet" href="/library">Back to backlog</Link><SubmitButton>Record post</SubmitButton></div>
      </form>
    </div>
  );
}

function Header() { return <header className="page-header"><div><span className="eyebrow">One idea, many destinations</span><h1>Record Post</h1><p>Each destination is one publication row. Reusing the same content opportunity keeps editorial variety accurate.</p></div></header>; }
