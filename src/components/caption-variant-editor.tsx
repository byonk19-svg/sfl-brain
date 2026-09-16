"use client";

import { useState, type FormEvent } from "react";

import type { PostPackageCaptionVariant } from "@/lib/post-package";
import { copyBaseCaption } from "@/lib/post-package";
import { CopyButton } from "@/components/copy-button";

type DestinationOption = { id: string; name: string };
type FormAction = (formData: FormData) => void | Promise<void>;

export function CaptionVariantEditor({
  packageId,
  opportunityId,
  expectedUpdatedAt,
  baseCaption,
  variants,
  destinations,
  saveVariant,
}: {
  packageId: string;
  opportunityId: string;
  expectedUpdatedAt: string;
  baseCaption: string | null;
  variants: PostPackageCaptionVariant[];
  destinations: DestinationOption[];
  saveVariant?: FormAction;
}) {
  const [draftBody, setDraftBody] = useState(() => copyBaseCaption(baseCaption));
  const [kind, setKind] = useState<"audience" | "destination">("audience");
  const [audience, setAudience] = useState("sfl_page");

  function submitWithStatus(event: FormEvent<HTMLButtonElement>, status: "draft" | "approved") {
    const form = event.currentTarget.form;
    if (!form) return;
    const statusField = form.elements.namedItem("status") as HTMLInputElement | null;
    if (statusField) statusField.value = status;
  }

  return (
    <div className="package-subsection">
      <h3>Caption variants</h3>
      {variants.length > 0 && (
        <div className="package-card-list">
          {variants.map((variant) => (
            <article className="package-card" key={variant.id}>
              <div className="package-card-heading">
                <strong>{variantDisplayLabel(variant, destinations)}</strong>
                <span className={`package-status status-${variant.status}`}>{variant.status === "approved" ? "Approved" : "Draft"}</span>
              </div>
              <p className="package-copy">{variant.body}</p>
              {variant.status === "approved" && <CopyButton value={variant.body} label={`Copy ${variantDisplayLabel(variant, destinations)} caption`} />}
              <details className="inline-editor">
                <summary>Edit variant</summary>
                <VariantForm
                  packageId={packageId}
                  opportunityId={opportunityId}
                  expectedUpdatedAt={expectedUpdatedAt}
                  variant={variant}
                  destinations={destinations}
                  saveVariant={saveVariant}
                />
              </details>
            </article>
          ))}
        </div>
      )}

      <details className="inline-editor" open={variants.length === 0}>
        <summary>Create caption variant</summary>
        <form action={saveVariant} className="compact-form single-column">
          <input type="hidden" name="package_id" value={packageId} />
          <input type="hidden" name="opportunity_id" value={opportunityId} />
          <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
          <input type="hidden" name="status" defaultValue="draft" />
          <label>
            Variant kind
            <select value={kind} onChange={(event) => {
              const nextKind = event.target.value as "audience" | "destination";
              setKind(nextKind);
              if (nextKind === "destination") setAudience("custom");
            }}>
              <option value="audience">Audience variant</option>
              <option value="destination">Destination override</option>
            </select>
          </label>
          <label>
            Audience
            <select name="audience" value={kind === "destination" ? "custom" : audience} onChange={(event) => setAudience(event.target.value)} disabled={kind === "destination"}>
              <option value="sfl_page">SFL Page</option>
              <option value="sfl_groups">SFL groups</option>
              <option value="personal_groups">Personal groups</option>
              <option value="instagram">Instagram</option>
              <option value="custom">Custom audience</option>
            </select>
            {kind === "destination" && <input type="hidden" name="audience" value="custom" />}
          </label>
          {kind === "destination" && (
            <label>
              Exact destination
              <select name="destination_id" required defaultValue="">
                <option value="" disabled>Choose destination</option>
                {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
              </select>
            </label>
          )}
          <label>
            Caption copy
            <textarea name="body" rows={6} required value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
          </label>
          <div className="package-actions">
            <button className="button button-quiet" type="submit" onClick={(event) => submitWithStatus(event, "draft")}>Save draft variant</button>
            <button className="button" type="submit" onClick={(event) => submitWithStatus(event, "approved")}>Approve variant</button>
          </div>
        </form>
      </details>
    </div>
  );
}

function VariantForm({ packageId, opportunityId, expectedUpdatedAt, variant, destinations, saveVariant }: {
  packageId: string;
  opportunityId: string;
  expectedUpdatedAt: string;
  variant: PostPackageCaptionVariant;
  destinations: DestinationOption[];
  saveVariant?: FormAction;
}) {
  return (
    <form action={saveVariant} className="compact-form single-column">
      <input type="hidden" name="package_id" value={packageId} />
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <input type="hidden" name="variant_id" value={variant.id} />
      <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
      <input type="hidden" name="audience" value={variant.audience} />
      {variant.destination_id && <input type="hidden" name="destination_id" value={variant.destination_id} />}
      {variant.destination_id && <p className="form-help">Exact destination: {destinations.find((item) => item.id === variant.destination_id)?.name ?? "Inactive destination"}</p>}
      <label>Caption copy<textarea name="body" rows={6} required defaultValue={variant.body} /></label>
      <label>Status<select name="status" defaultValue={variant.status}><option value="draft">Draft</option><option value="approved">Approved</option></select></label>
      <button className="button" type="submit">Save variant</button>
    </form>
  );
}

function audienceLabel(audience: PostPackageCaptionVariant["audience"]) {
  return {
    sfl_page: "SFL Page",
    sfl_groups: "SFL groups",
    personal_groups: "Personal groups",
    instagram: "Instagram",
    custom: "Custom audience",
  }[audience];
}

function variantDisplayLabel(variant: PostPackageCaptionVariant, destinations: DestinationOption[]) {
  if (!variant.destination_id) return audienceLabel(variant.audience);
  const destination = destinations.find((item) => item.id === variant.destination_id);
  return `Destination override · ${destination?.name ?? variant.destination_id}`;
}
