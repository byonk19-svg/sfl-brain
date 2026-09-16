import Link from "next/link";

import { createDestinationAction, updateDestinationAction } from "@/app/actions";
import { Notice, SetupNotice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { humanize } from "@/lib/format";
import { createWebsiteBrainService } from "@/lib/website-auth";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DestinationsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const success = Array.isArray(query.success) ? query.success[0] : query.success;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  let destinations;
  try {
    destinations = await (await createWebsiteBrainService()).getDestinations();
  } catch (caught) {
    return <div className="page-shell narrow-shell"><Header /><SetupNotice message={caught instanceof Error ? caught.message : "Destinations could not load."} /></div>;
  }

  const active = destinations.filter((item) => item.is_active);
  const inactive = destinations.filter((item) => !item.is_active);
  return (
    <div className="page-shell narrow-shell">
      <Header />
      <Notice success={success} error={error} />
      <section className="detail-section">
        <div className="section-heading"><span>01</span><h2>Active destinations</h2></div>
        {active.length ? <DestinationList destinations={active} /> : <p className="muted">No active destinations yet.</p>}
      </section>
      <section className="detail-section">
        <div className="section-heading"><span>02</span><h2>Add destination</h2></div>
        <DestinationForm action={createDestinationAction} />
      </section>
      {inactive.length > 0 && <section className="detail-section"><div className="section-heading"><span>03</span><h2>Inactive destinations</h2></div><DestinationList destinations={inactive} /></section>}
    </div>
  );
}

function Header() {
  return <header className="page-header"><div><Link className="back-link" href="/record-post">← Record Post</Link><span className="eyebrow">Exact publishing endpoints</span><h1>Destinations</h1><p>Keep each page, group, profile, or feed distinct so every Post Package records exactly where its copy went.</p></div></header>;
}

function DestinationList({ destinations }: { destinations: Array<{ id: string; name: string; platform: string; posting_identity: string; notes: string | null; is_active: boolean }> }) {
  return <div className="destination-list">{destinations.map((destination) => <article className="destination-card" key={destination.id}><div className="package-card-heading"><div><strong>{destination.name}</strong><span>{humanize(destination.platform)} · {destination.posting_identity}</span></div><span className={`package-status ${destination.is_active ? "status-approved" : "status-skipped"}`}>{destination.is_active ? "Active" : "Inactive"}</span></div>{destination.notes && <p>{destination.notes}</p>}<details className="inline-editor"><summary>Edit destination</summary><DestinationForm action={updateDestinationAction} destination={destination} /></details></article>)}</div>;
}

function DestinationForm({ action, destination }: { action: (formData: FormData) => void | Promise<void>; destination?: { id: string; name: string; platform: string; posting_identity: string; notes: string | null; is_active: boolean } }) {
  return <form action={action} className="compact-form single-column">{destination && <input type="hidden" name="id" value={destination.id} />}<label>Name<input name="name" required defaultValue={destination?.name ?? ""} /></label><label>Platform<select name="platform" defaultValue={destination?.platform ?? "facebook_page"}><option value="facebook_page">Facebook page</option><option value="facebook_group">Facebook group</option><option value="facebook_personal">Facebook personal</option><option value="instagram_feed">Instagram feed</option><option value="instagram_reel">Instagram reel</option><option value="instagram_story">Instagram story</option><option value="other">Other</option></select></label><label>Posting identity<input name="posting_identity" required defaultValue={destination?.posting_identity ?? ""} /></label><label>Notes<textarea name="notes" rows={3} defaultValue={destination?.notes ?? ""} /></label>{destination && <label>Status<select name="is_active" defaultValue={String(destination.is_active)}><option value="true">Active</option><option value="false">Inactive</option></select></label>}<SubmitButton>{destination ? "Save destination" : "Add destination"}</SubmitButton></form>;
}
