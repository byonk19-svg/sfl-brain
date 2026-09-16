export const POST_PACKAGE_STATUSES = ["draft", "publishing", "closed", "abandoned"] as const;
export const CAPTION_VARIANT_STATUSES = ["draft", "approved"] as const;
export const CAPTION_AUDIENCES = [
  "sfl_page",
  "sfl_groups",
  "personal_groups",
  "instagram",
  "custom",
] as const;
export const PACKAGE_ASSET_ROLES = ["hero", "supporting", "comparison"] as const;
export const DISTRIBUTION_ITEM_STATUSES = ["planned", "published", "skipped"] as const;
export const POST_PACKAGE_SOURCES = [
  "website",
  "chatgpt_connector",
  "development_tunnel",
  "migration",
] as const;

export type PostPackageStatus = (typeof POST_PACKAGE_STATUSES)[number];
export type CaptionVariantStatus = (typeof CAPTION_VARIANT_STATUSES)[number];
export type CaptionAudience = (typeof CAPTION_AUDIENCES)[number];
export type PackageAssetRole = (typeof PACKAGE_ASSET_ROLES)[number];
export type DistributionItemStatus = (typeof DISTRIBUTION_ITEM_STATUSES)[number];
export type PostPackageSource = (typeof POST_PACKAGE_SOURCES)[number];
export type MutablePostPackageSource = Exclude<PostPackageSource, "migration">;

export interface PostPackageSummary {
  id: string;
  opportunity_id: string;
  sequence: number;
  status: PostPackageStatus;
  base_caption: string | null;
  working_angle: string | null;
  notes: string | null;
  created_source: PostPackageSource;
  updated_source: PostPackageSource;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  abandoned_at: string | null;
}

export interface PostPackageCaptionVariant {
  id: string;
  audience: CaptionAudience;
  destination_id: string | null;
  body: string;
  status: CaptionVariantStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostPackageAsset {
  asset_id: string;
  role: PackageAssetRole;
  position: number;
  note: string | null;
  asset: {
    id: string;
    title: string | null;
    asset_type: string;
    source: string | null;
    captured_at: string | null;
    signed_url: string | null;
  };
}

export interface PostPackageDistributionItem {
  id: string;
  destination_id: string;
  caption_variant_id: string;
  status: DistributionItemStatus;
  post_id: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
  destination: {
    id: string;
    name: string;
    platform: string;
    posting_identity: string;
    notes: string | null;
    is_active: boolean;
  };
}

export interface PostPackage extends PostPackageSummary {
  caption_variants: PostPackageCaptionVariant[];
  assets: PostPackageAsset[];
  distribution_items: PostPackageDistributionItem[];
}

export interface PostPackageContext {
  opportunity_id: string;
  active_package: PostPackage | null;
  prior_packages: PostPackage[];
}

export function canFinishPackage(input: {
  status: PostPackageStatus;
  items: Array<{ status: DistributionItemStatus }>;
}) {
  return input.status === "publishing" && input.items.every((item) => item.status !== "planned");
}

export function copyBaseCaption(baseCaption: string | null | undefined) {
  return baseCaption?.trim() ?? "";
}

export function sortPackageAssets<T extends { position: number }>(assets: readonly T[]) {
  return [...assets].sort((a, b) => a.position - b.position);
}

export function sourceLabel(source: PostPackageSource) {
  return {
    website: "Website",
    chatgpt_connector: "ChatGPT",
    development_tunnel: "Development tunnel",
    migration: "Migration",
  }[source];
}
