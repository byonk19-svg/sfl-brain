import {
  placeOpportunityOnHoldAction,
  releaseOpportunityHoldAction,
  updateOpportunityHoldAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type CurrentHold = {
  id: string;
  hold_reason: string;
  release_condition: string;
  review_on: string | null;
  updated_at: string;
};

export function OpportunityHoldForm({
  opportunityId,
  currentHold,
  compact = false,
}: {
  opportunityId: string;
  currentHold?: CurrentHold;
  compact?: boolean;
}) {
  if (!currentHold) {
    return <details className={`inline-editor hold-editor${compact ? " compact-hold-editor" : ""}`}><summary>Put on hold</summary><form action={placeOpportunityOnHoldAction} className="compact-form"><input type="hidden" name="opportunity_id" value={opportunityId} /><label>Hold reason<textarea name="hold_reason" rows={2} required /></label><label>Release condition<textarea name="release_condition" rows={2} required /></label><label>Review date (optional)<input name="review_on" type="date" /></label><SubmitButton>Move to On hold</SubmitButton></form></details>;
  }
  return <div className="hold-controls"><details className="inline-editor hold-editor"><summary>Edit hold</summary><form action={updateOpportunityHoldAction} className="compact-form"><input type="hidden" name="opportunity_id" value={opportunityId} /><input type="hidden" name="hold_id" value={currentHold.id} /><input type="hidden" name="expected_updated_at" value={currentHold.updated_at} /><label>Hold reason<textarea name="hold_reason" rows={2} required defaultValue={currentHold.hold_reason} /></label><label>Release condition<textarea name="release_condition" rows={2} required defaultValue={currentHold.release_condition} /></label><label>Review date (optional)<input name="review_on" type="date" defaultValue={currentHold.review_on ?? ""} /></label><SubmitButton>Save hold</SubmitButton></form></details><form action={releaseOpportunityHoldAction}><input type="hidden" name="opportunity_id" value={opportunityId} /><input type="hidden" name="hold_id" value={currentHold.id} /><input type="hidden" name="expected_updated_at" value={currentHold.updated_at} /><button className="text-button" type="submit">Return to backlog</button></form></div>;
}
