import type { PostPackageAsset } from "@/lib/post-package";

type AssetOption = { id: string; title: string | null; asset_type: string; signed_url?: string | null };
type FormAction = (formData: FormData) => void | Promise<void>;

export function PackageAssetEditor({ packageId, opportunityId, expectedUpdatedAt, selections, assets, saveAssets, uploadAsset }: {
  packageId: string;
  opportunityId: string;
  expectedUpdatedAt: string;
  selections: PostPackageAsset[];
  assets: AssetOption[];
  saveAssets?: FormAction;
  uploadAsset?: FormAction;
}) {
  const selectedIds = new Set(selections.map((selection) => selection.asset_id));
  return (
    <div className="package-subsection">
      <h3>Package assets</h3>
      <form action={saveAssets} className="package-table-form">
        <input type="hidden" name="package_id" value={packageId} />
        <input type="hidden" name="opportunity_id" value={opportunityId} />
        <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
        <div className="package-asset-list">
          {assets.map((asset) => {
            const selected = selections.find((selection) => selection.asset_id === asset.id);
            const preview = selected?.asset.signed_url ?? asset.signed_url;
            return (
              <article className="package-asset-row" key={asset.id}>
                {/* Signed private previews use short-lived hosts that are intentionally not configured for Next Image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt={asset.title ?? `${asset.asset_type} preview`} /> : <div className="asset-placeholder">No preview</div>}
                <label className="package-asset-choice"><input type="checkbox" name="asset_ids" value={asset.id} defaultChecked={selectedIds.has(asset.id)} />{asset.title ?? asset.asset_type}</label>
                <label>Role<select name={`asset_role_${asset.id}`} defaultValue={selected?.role ?? "supporting"}><option value="hero">Hero</option><option value="supporting">Supporting</option><option value="comparison">Comparison</option></select></label>
                <label>Order<input name={`asset_position_${asset.id}`} type="number" min="0" max="99" defaultValue={selected?.position ?? selections.length} /></label>
                <label>Package note<input name={`asset_note_${asset.id}`} defaultValue={selected?.note ?? ""} /></label>
              </article>
            );
          })}
        </div>
        {assets.length ? <button className="button" type="submit">Save asset selection</button> : <p className="muted">Attach or upload an asset to this opportunity first.</p>}
      </form>
      <details className="inline-editor">
        <summary>Upload and attach a new asset</summary>
        <form action={uploadAsset} className="compact-form single-column">
          <input type="hidden" name="opportunity_id" value={opportunityId} />
          <input type="hidden" name="package_id" value={packageId} />
          <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
          <input type="hidden" name="current_assets" value={JSON.stringify(selections.map(({ asset_id, role, position, note }) => ({ asset_id, role, position, note })))} />
          <label>File<input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" required /></label>
          <label>Title<input name="title" /></label>
          <label>Source<select name="source" defaultValue="home"><option value="home">Home</option><option value="in_store">In store</option><option value="canva">Canva</option><option value="web">Web</option><option value="other">Other</option></select></label>
          <button className="button" type="submit">Upload asset</button>
        </form>
      </details>
    </div>
  );
}
