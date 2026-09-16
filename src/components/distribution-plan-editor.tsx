import Link from "next/link";

import type { PostPackageCaptionVariant, PostPackageDistributionItem } from "@/lib/post-package";

type DestinationOption = { id: string; name: string; is_active?: boolean };
type FormAction = (formData: FormData) => void | Promise<void>;

export function DistributionPlanEditor({ packageId, opportunityId, expectedUpdatedAt, items, variants, destinations, savePlan, skipDestination }: {
  packageId: string;
  opportunityId: string;
  expectedUpdatedAt: string;
  items: PostPackageDistributionItem[];
  variants: PostPackageCaptionVariant[];
  destinations: DestinationOption[];
  savePlan?: FormAction;
  skipDestination?: FormAction;
}) {
  const approved = variants.filter((variant) => variant.status === "approved");
  return (
    <div className="package-subsection">
      <div className="package-subsection-heading"><h3>Distribution plan</h3><Link href="/destinations">Manage destinations</Link></div>
      {items.length > 0 && <div className="distribution-list">{items.map((item) => (
        <article className="distribution-row" key={item.id}>
          <div><strong>{item.destination.name}</strong><span>{item.destination.posting_identity}</span></div>
          <span className={`package-status status-${item.status}`}>{statusLabel(item.status)}</span>
          {item.status === "planned" && (
            <>
              <p className="publication-pending">Publication recording will be available here once package publishing is connected.</p>
              <form action={skipDestination} className="skip-form">
                <input type="hidden" name="package_id" value={packageId} />
                <input type="hidden" name="opportunity_id" value={opportunityId} />
                <input type="hidden" name="distribution_item_id" value={item.id} />
                <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
                <label>Skip reason<input name="skip_reason" required /></label>
                <button className="text-button" type="submit">Skip destination</button>
              </form>
            </>
          )}
          {item.status === "skipped" && <span>{item.skip_reason}</span>}
        </article>
      ))}</div>}
      <details className="inline-editor" open={items.length === 0}>
        <summary>Edit distribution plan</summary>
        <form action={savePlan} className="compact-form single-column">
          <input type="hidden" name="package_id" value={packageId} />
          <input type="hidden" name="opportunity_id" value={opportunityId} />
          <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
          {items.filter((item) => item.status !== "planned").map((item) => <span key={`fixed-${item.id}`}><input type="hidden" name="destination_ids" value={item.destination_id} /><input type="hidden" name={`caption_variant_${item.destination_id}`} value={item.caption_variant_id} /></span>)}
          {destinations.filter((destination) => destination.is_active !== false && !items.some((item) => item.destination_id === destination.id && item.status !== "planned")).map((destination) => {
            const existing = items.find((item) => item.destination_id === destination.id && item.status === "planned");
            return (
              <div className="distribution-choice" key={destination.id}>
                <label className="choice"><input type="checkbox" name="destination_ids" value={destination.id} defaultChecked={Boolean(existing)} />{destination.name}</label>
                <label>Caption variant<select name={`caption_variant_${destination.id}`} defaultValue={existing?.caption_variant_id ?? ""}><option value="">Choose approved copy</option>{approved.filter((variant) => !variant.destination_id || variant.destination_id === destination.id).map((variant) => <option key={variant.id} value={variant.id}>{variant.destination_id ? "Destination override" : variant.audience.replaceAll("_", " ")}</option>)}</select></label>
              </div>
            );
          })}
          {destinations.length ? <button className="button" type="submit">Save distribution plan</button> : <p className="muted">Add a destination before planning distribution.</p>}
        </form>
      </details>
    </div>
  );
}

function statusLabel(status: PostPackageDistributionItem["status"]) {
  return status[0]!.toUpperCase() + status.slice(1);
}
