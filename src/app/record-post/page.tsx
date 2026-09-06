import { recordPostAction } from "@/app/actions";
import { Notice, SetupNotice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { createBrainService } from "@/lib/brain";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function localDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default async function RecordPostPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedProduct = (Array.isArray(params.product) ? params.product[0] : params.product) ?? "";
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  let options;
  try { options = await createBrainService().getFormOptions(); }
  catch (caught) { return <div className="page-shell narrow-shell"><Header /><SetupNotice message={caught instanceof Error ? caught.message : "Posting options could not load."} /></div>; }

  return (
    <div className="page-shell narrow-shell">
      <Header />
      <Notice error={error} />
      <form action={recordPostAction} className="editor-form">
        <section className="form-section"><div className="section-number">01</div><div className="form-section-body"><h2>Where and when</h2><div className="field-grid"><label>Destination<select name="destination_id" required defaultValue=""><option value="" disabled>Choose destination</option>{options.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select></label><label>Published at<input type="datetime-local" name="published_at" required defaultValue={localDateTime()} /></label></div></div></section>
        <section className="form-section"><div className="section-number">02</div><div className="form-section-body"><h2>Products</h2><div className="choice-grid">{options.products.map((product) => <label className="choice" key={product.id}><input type="checkbox" name="product_ids" value={product.id} defaultChecked={product.id === selectedProduct} /><span>{product.name}</span></label>)}</div></div></section>
        <section className="form-section"><div className="section-number">03</div><div className="form-section-body"><h2>Post context</h2><div className="field-grid"><label className="span-2">Caption<textarea rows={4} name="caption" /></label><label>Angle<input name="angle" placeholder="small-space styling" /></label><label>Performance<select name="performance_label" defaultValue="unknown"><option value="unknown">Unknown</option><option value="weak">Weak</option><option value="normal">Normal</option><option value="winner">Winner</option></select></label><label className="span-2">Notes<textarea rows={2} name="notes" /></label></div></div></section>
        {options.assets.length > 0 && <section className="form-section"><div className="section-number">04</div><div className="form-section-body"><h2>Assets used <small>Optional</small></h2><div className="choice-grid">{options.assets.map((asset) => <label className="choice" key={asset.id}><input type="checkbox" name="asset_ids" value={asset.id} /><span>{asset.title ?? asset.asset_type}</span></label>)}</div></div></section>}
        <div className="form-actions"><SubmitButton>Record post</SubmitButton></div>
      </form>
    </div>
  );
}

function Header() { return <header className="page-header"><div><span className="eyebrow">Close the loop</span><h1>Record Post</h1><p>One publication to one destination. Add another row when the same content goes somewhere else.</p></div></header>; }
