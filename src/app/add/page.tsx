import { createProductAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AddPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return (
    <div className="page-shell narrow-shell">
      <header className="page-header"><div><span className="eyebrow">A few useful facts</span><h1>Add to the Brain</h1><p>Start with the product. Listing and affiliate details are optional.</p></div></header>
      <Notice error={error} />
      <form action={createProductAction} className="editor-form">
        <section className="form-section"><div className="section-number">01</div><div className="form-section-body"><h2>Product</h2><div className="field-grid"><label className="span-2">Name<input name="name" required autoFocus /></label><label>Brand<input name="brand" /></label><label>Category<input name="category" /></label><label>Experience<select name="experience_level" defaultValue="owned"><option value="online_only">Online only</option><option value="seen_in_store">Seen in store</option><option value="handled_in_store">Handled in store</option><option value="owned">Owned</option><option value="used_at_home">Used at home</option></select></label><label className="span-2">Tags<input name="tags" placeholder="chair, neutral, living room" /><small>Separate tags with commas.</small></label><label className="span-2">Notes<textarea name="notes" rows={3} /></label></div></div></section>
        <section className="form-section"><div className="section-number">02</div><div className="form-section-body"><h2>Primary listing <small>Optional</small></h2><div className="field-grid"><label>Retailer<input name="retailer" /></label><label>Canonical URL<input name="canonical_url" type="url" placeholder="https://demo.example/item" /></label><label>Current price<input name="current_price" type="number" min="0" step="0.01" /></label><label>Stock<select name="stock_status" defaultValue="unknown"><option value="unknown">Unknown</option><option value="in_stock">In stock</option><option value="limited">Limited</option><option value="out_of_stock">Out of stock</option></select></label></div></div></section>
        <section className="form-section"><div className="section-number">03</div><div className="form-section-body"><h2>Affiliate link <small>Optional</small></h2><div className="field-grid"><label>Network<input name="affiliate_network" placeholder="later_creator" /></label><label>Affiliate URL<input name="affiliate_url" type="url" /></label></div></div></section>
        <div className="form-actions"><SubmitButton>Add product</SubmitButton></div>
      </form>
    </div>
  );
}
