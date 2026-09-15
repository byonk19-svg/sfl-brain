import { formatDateOnly } from "@/lib/format";

export function OpportunityHoldReview({
  reviewDue,
  reviewOn,
}: {
  reviewDue: boolean;
  reviewOn: string | null;
}) {
  if (reviewDue) return <span className="review-due">Due for review</span>;
  return <span>{reviewOn ? formatDateOnly(reviewOn) : "No review date"}</span>;
}
