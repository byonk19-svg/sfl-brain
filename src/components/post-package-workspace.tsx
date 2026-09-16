import type { PostPackageContext } from "@/lib/post-package";
import { canFinishPackage, sourceLabel } from "@/lib/post-package";
import { CaptionVariantEditor } from "@/components/caption-variant-editor";
import { DistributionPlanEditor } from "@/components/distribution-plan-editor";
import { PackageAssetEditor } from "@/components/package-asset-editor";

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
      {context.prior_packages.length > 0 && <div className="package-archive"><h3>Prior packages</h3>{context.prior_packages.map((item) => <details key={item.id} data-read-only="true"><summary>Package {item.sequence} · {item.status === "closed" ? "Closed" : "Abandoned"}</summary><div className="package-archive-body"><p className="package-copy">{item.base_caption || "No base caption was preserved."}</p><dl><div><dt>Created through</dt><dd>{sourceLabel(item.created_source)}</dd></div><div><dt>Caption variants</dt><dd>{item.caption_variants.length}</dd></div><div><dt>Assets</dt><dd>{item.assets.length}</dd></div><div><dt>Destinations</dt><dd>{item.distribution_items.length}</dd></div></dl></div></details>)}</div>}
    </section>
  );
}
