import { formatDateOnly, formatDateTime } from "@/lib/format";

const HOLD_SOURCE_LABELS: Record<string, string> = {
  website: "website",
  chatgpt_connector: "ChatGPT connector",
  migration: "migration",
};

export function OpportunityHoldSummary({
  holdReason,
  releaseCondition,
  reviewOn,
  heldAt,
  heldSource,
}: {
  holdReason: string;
  releaseCondition: string;
  reviewOn: string | null;
  heldAt: string;
  heldSource: string;
}) {
  return (
    <>
      <p><strong>Why:</strong> {holdReason}</p>
      <p><strong>Release when:</strong> {releaseCondition}</p>
      <p><strong>Review:</strong> {reviewOn ? formatDateOnly(reviewOn) : "No review date"}</p>
      <p className="hold-provenance"><strong>Held:</strong> {formatDateTime(heldAt)} via {HOLD_SOURCE_LABELS[heldSource] ?? "unknown source"}</p>
    </>
  );
}
