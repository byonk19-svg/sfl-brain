import type { PostPackageContext } from "@/lib/post-package";
import { canFinishPackage, sourceLabel } from "@/lib/post-package";
import { CaptionVariantEditor } from "@/components/caption-variant-editor";
import { DistributionPlanEditor } from "@/components/distribution-plan-editor";
import { AssetPreview, PackageAssetEditor } from "@/components/package-asset-editor";
import { CopyButton } from "@/components/copy-button";

type FormAction = (formData: FormData) => void | Promise<void>;
type DestinationOption = { id: string; name: string; platform: string; posting_identity: string; notes: string | null; is_active: boolean };
type AssetOption = { id: string; title: string | null; asset_type: string; signed_url?: string | null };

export type PostPackageWorkspaceActions = Partial<{
  startPackage: FormAction;
  updatePackage: FormAction;
  saveVariant: FormAction;
  saveAssets: FormAction;
  savePlan: FormAction;
  skipDestination: FormAction;
  finishPackage: FormAction;
  uploadAsset: FormAction;
}>;

export function PostPackageWorkspace({ context, destinations, opportunityAssets, actions = {} }: {
  context: PostPackageContext;
  destinations: DestinationOption[];
  opportunityAssets: AssetOption[];
  actions?: PostPackageWorkspaceActions;
}) {
  const active = context.active_package;
  return (
    <section className="detail-section post-package-workspace" aria-labelledby="post-package-heading">
      <div className="section-heading"><span>PP</span><h2 id="post-package-heading">Post Package</h2></div>
      {!active ? (
        <div className="package-empty">
          <p>Start a versioned publishing cycle to keep exact copy, creative, and destinations together.</p>
          <form action={actions.startPackage} className="compact-form single-column">
            <input type="hidden" name="opportunity_id" value={context.opportunity_id} />
            <label>Base caption<textarea name="base_caption" rows={6} /></label>
            <label>Working angle<input name="working_angle" /></label>
            <label>Working notes<textarea name="notes" rows={3} /></label>
            <button className="button" type="submit">Start package</button>
          </form>
        </div>
      ) : (
        <div className="active-package">
          <div className="package-heading">
            <div><span className="eyebrow">Active package {active.sequence}</span><h3>{active.status === "draft" ? "Draft" : "Publishing"}</h3></div>
            <span className={`package-status status-${active.status}`}>{active.status === "draft" ? "Draft" : "Publishing"}</span>
          </div>
          <form action={actions.updatePackage} className="compact-form single-column package-working-copy">
            <input type="hidden" name="package_id" value={active.id} />
            <input type="hidden" name="opportunity_id" value={context.opportunity_id} />
            <input type="hidden" name="expected_updated_at" value={active.updated_at} />
            <label>Base caption<textarea name="base_caption" rows={6} defaultValue={active.base_caption ?? ""} /></label>
            <label>Working angle<input name="working_angle" defaultValue={active.working_angle ?? ""} /></label>
            <label>Working notes<textarea name="notes" rows={3} defaultValue={active.notes ?? ""} /></label>
            <button className="button" type="submit">Save package context</button>
          </form>
          <CaptionVariantEditor packageId={active.id} opportunityId={context.opportunity_id} expectedUpdatedAt={active.updated_at} baseCaption={active.base_caption} variants={active.caption_variants} destinations={destinations} saveVariant={actions.saveVariant} />
          <PackageAssetEditor packageId={active.id} opportunityId={context.opportunity_id} expectedUpdatedAt={active.updated_at} selections={active.assets} assets={opportunityAssets} saveAssets={actions.saveAssets} uploadAsset={actions.uploadAsset} />
          <DistributionPlanEditor packageId={active.id} opportunityId={context.opportunity_id} expectedUpdatedAt={active.updated_at} items={active.distribution_items} variants={active.caption_variants} destinations={destinations} savePlan={actions.savePlan} skipDestination={actions.skipDestination} />
          <form action={actions.finishPackage} className="package-finish-form">
            <input type="hidden" name="package_id" value={active.id} />
            <input type="hidden" name="opportunity_id" value={context.opportunity_id} />
            <input type="hidden" name="expected_updated_at" value={active.updated_at} />
            {active.status === "draft" ? (
              <><input type="hidden" name="outcome" value="abandoned" /><button className="button button-quiet" type="submit">Abandon package</button></>
            ) : (
              <><input type="hidden" name="outcome" value="closed" /><button className="button" type="submit" disabled={!canFinishPackage({ status: active.status, items: active.distribution_items })}>Close package</button>{active.distribution_items.some((item) => item.status === "planned") && <span className="form-help">Publish or skip every planned destination before closing.</span>}</>
            )}
          </form>
        </div>
      )}
      {context.prior_packages.length > 0 && <div className="package-archive"><h3>Prior packages</h3>{context.prior_packages.map((item) => <details key={item.id} data-read-only="true"><summary>Package {item.sequence} · {item.status === "closed" ? "Closed" : "Abandoned"}</summary><div className="package-archive-body">
        <div className="archive-context"><div><span>Base caption</span><p className="package-copy">{item.base_caption || "No base caption was preserved."}</p></div><div><span>Working angle</span><p>{item.working_angle || "No working angle was preserved."}</p></div><div><span>Working notes</span><p>{item.notes || "No working notes were preserved."}</p></div></div>
        <dl><div><dt>Created through</dt><dd>{sourceLabel(item.created_source)}</dd></div><div><dt>Status</dt><dd>{item.status === "closed" ? "Closed" : "Abandoned"}</dd></div></dl>
        <section className="archive-section"><h4>Caption variants</h4>{item.caption_variants.length ? item.caption_variants.map((variant) => {
          const destinationName = variant.destination_id ? item.distribution_items.find((distribution) => distribution.destination_id === variant.destination_id)?.destination.name : null;
          const variantLabel = `${archiveAudienceLabel(variant.audience)}${variant.destination_id ? ` · ${destinationName ?? variant.destination_id}` : ""}`;
          return <article className="archive-row" key={variant.id}><div><strong>{variantLabel}</strong><span>{variant.status === "approved" ? "Approved" : "Draft"}</span></div><p className="package-copy">{variant.body}</p>{variant.status === "approved" && <CopyButton value={variant.body} label={`Copy archived ${variantLabel} caption`} />}</article>;
        }) : <p className="muted">No caption variants were preserved.</p>}</section>
        <section className="archive-section"><h4>Package assets</h4>{item.assets.length ? item.assets.map((selection) => <article className="archive-asset-row" key={selection.asset_id}><AssetPreview signedUrl={selection.asset.signed_url} assetType={selection.asset.asset_type} title={selection.asset.title} /><div><strong>{selection.asset.title || "Untitled asset"}</strong><span>{archiveAssetDescription(selection.role, selection.position, selection.note)}</span><small>{selection.asset.asset_type}{selection.asset.source ? ` · ${selection.asset.source}` : ""}</small></div></article>) : <p className="muted">No package assets were preserved.</p>}</section>
        <section className="archive-section"><h4>Distribution</h4>{item.distribution_items.length ? item.distribution_items.map((distribution) => <article className="archive-row" key={distribution.id}><div><strong>{distribution.destination.name}</strong><span>{distribution.status[0]!.toUpperCase() + distribution.status.slice(1)}</span></div>{distribution.skip_reason && <p>{distribution.skip_reason}</p>}<small>{distribution.post_id ? `Publication ${distribution.post_id}` : "No publication recorded"}</small></article>) : <p className="muted">No distribution items were preserved.</p>}</section>
      </div></details>)}</div>}
    </section>
  );
}

function archiveAudienceLabel(audience: "sfl_page" | "sfl_groups" | "personal_groups" | "instagram" | "custom") {
  return { sfl_page: "SFL Page", sfl_groups: "SFL groups", personal_groups: "Personal groups", instagram: "Instagram", custom: "Custom audience" }[audience];
}

function archiveAssetDescription(role: "hero" | "supporting" | "comparison", position: number, note: string | null) {
  const roleLabel = role[0]!.toUpperCase() + role.slice(1);
  return `${roleLabel} · position ${position + 1}${note ? ` · ${note}` : ""}`;
}
