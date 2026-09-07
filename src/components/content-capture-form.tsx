import { SubmitButton } from "@/components/submit-button";

export function ContentCaptureForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="capture-form">
      <label className="capture-title">
        What are you working on?
        <input
          name="title"
          required
          autoFocus
          maxLength={200}
          placeholder="Corinne McGee box dupes"
        />
      </label>
      <div className="capture-grid">
        <label>
          Where is it at?
          <select name="status" defaultValue="idea">
            <option value="idea">Just an idea</option>
            <option value="needs_assets">Need pictures</option>
            <option value="needs_links">Pictures ready · need links</option>
            <option value="needs_caption">Need caption</option>
            <option value="ready">Ready to post</option>
          </select>
        </label>
        <label>
          What kind of content is it?
          <select name="content_type" defaultValue="standalone_product">
            <option value="standalone_product">Standalone product find</option>
            <option value="comparison">Comparison / dupe</option>
            <option value="in_store_find">In-store find</option>
            <option value="styled_at_home">Styled at home</option>
            <option value="sale_restock">Sale / restock</option>
            <option value="collection_roundup">Collection / roundup</option>
            <option value="lifestyle_shop_the_look">Lifestyle / shop the look</option>
            <option value="recommendation_response">Recommendation / response</option>
            <option value="reel_video">Reel / video</option>
          </select>
        </label>
      </div>
      <label>
        Anything else?
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Optional note"
        />
      </label>
      <div className="capture-actions">
        <span>Products, assets, and links can be added later.</span>
        <SubmitButton>Save to backlog</SubmitButton>
      </div>
    </form>
  );
}
