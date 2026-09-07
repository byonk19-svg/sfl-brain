import { createContentOpportunityAction } from "@/app/actions";
import { ContentCaptureForm } from "@/components/content-capture-form";
import { Notice } from "@/components/notice";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AddContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return (
    <div className="page-shell capture-shell">
      <header className="page-header capture-header">
        <div>
          <span className="eyebrow">Ten-second capture</span>
          <h1>Add Content</h1>
          <p>Save the idea now. Fill in the database details when they matter.</p>
        </div>
      </header>
      <Notice error={error} />
      <ContentCaptureForm action={createContentOpportunityAction} />
    </div>
  );
}
