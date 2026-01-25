/**
 * TypeScript types for App Store Connect API responses
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ResourceLinks {
  self: string;
}

export interface RelationshipLinks {
  self?: string;
  related?: string;
}

export interface Relationship<T extends string = string> {
  data?:
    | {
        type: T;
        id: string;
      }
    | Array<{
        type: T;
        id: string;
      }>;
  links?: RelationshipLinks;
}

export interface PaginationLinks {
  self: string;
  first?: string;
  next?: string;
  prev?: string;
}

export interface PagedDocumentMeta {
  paging?: {
    total?: number;
    limit: number;
  };
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface ASCResponse<T> {
  data: T;
  links?: ResourceLinks;
  included?: unknown[];
}

export interface ASCListResponse<T> {
  data: T[];
  links: PaginationLinks;
  meta?: PagedDocumentMeta;
  included?: unknown[];
}

export interface ASCErrorDetail {
  id?: string;
  status: string;
  code: string;
  title: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
}

export interface ASCErrorResponse {
  errors: ASCErrorDetail[];
}

// ============================================================================
// Platform & State Enums
// ============================================================================

export type Platform = "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";

export type AppStoreVersionState =
  | "DEVELOPER_REMOVED_FROM_SALE"
  | "DEVELOPER_REJECTED"
  | "IN_REVIEW"
  | "INVALID_BINARY"
  | "METADATA_REJECTED"
  | "PENDING_APPLE_RELEASE"
  | "PENDING_CONTRACT"
  | "PENDING_DEVELOPER_RELEASE"
  | "PREPARE_FOR_SUBMISSION"
  | "PREORDER_READY_FOR_SALE"
  | "PROCESSING_FOR_APP_STORE"
  | "READY_FOR_REVIEW"
  | "READY_FOR_SALE"
  | "REJECTED"
  | "REMOVED_FROM_SALE"
  | "WAITING_FOR_EXPORT_COMPLIANCE"
  | "WAITING_FOR_REVIEW"
  | "REPLACED_WITH_NEW_VERSION"
  | "NOT_APPLICABLE";

export type ReleaseType = "MANUAL" | "AFTER_APPROVAL" | "SCHEDULED";

export type ScreenshotDisplayType =
  | "APP_IPHONE_67"
  | "APP_IPHONE_61"
  | "APP_IPHONE_65"
  | "APP_IPHONE_58"
  | "APP_IPHONE_55"
  | "APP_IPHONE_47"
  | "APP_IPHONE_40"
  | "APP_IPHONE_35"
  | "APP_IPAD_PRO_3GEN_129"
  | "APP_IPAD_PRO_3GEN_11"
  | "APP_IPAD_PRO_129"
  | "APP_IPAD_105"
  | "APP_IPAD_97"
  | "APP_WATCH_ULTRA"
  | "APP_WATCH_SERIES_7"
  | "APP_WATCH_SERIES_4"
  | "APP_WATCH_SERIES_3"
  | "APP_DESKTOP"
  | "APP_APPLE_TV";

// ============================================================================
// App Resources
// ============================================================================

export interface AppAttributes {
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
  contentRightsDeclaration?: "DOES_NOT_USE_THIRD_PARTY_CONTENT" | "USES_THIRD_PARTY_CONTENT";
  isOrEverWasMadeForKids?: boolean;
  availableInNewTerritories?: boolean;
}

export interface AppRelationships {
  appStoreVersions?: Relationship<"appStoreVersions">;
  preReleaseVersions?: Relationship<"preReleaseVersions">;
  betaGroups?: Relationship<"betaGroups">;
  betaAppLocalizations?: Relationship<"betaAppLocalizations">;
  builds?: Relationship<"builds">;
  appInfos?: Relationship<"appInfos">;
  endUserLicenseAgreement?: Relationship<"endUserLicenseAgreements">;
  appPricePoints?: Relationship<"appPricePoints">;
  prices?: Relationship<"appPrices">;
  availableTerritories?: Relationship<"territories">;
  inAppPurchases?: Relationship<"inAppPurchases">;
  gameCenterEnabledVersions?: Relationship<"gameCenterEnabledVersions">;
}

export interface App {
  type: "apps";
  id: string;
  attributes: AppAttributes;
  relationships?: AppRelationships;
  links: ResourceLinks;
}

// ============================================================================
// App Store Version Resources
// ============================================================================

export interface AppStoreVersionAttributes {
  platform: Platform;
  versionString: string;
  appStoreState: AppStoreVersionState;
  copyright?: string;
  releaseType?: ReleaseType;
  earliestReleaseDate?: string;
  usesIdfa?: boolean;
  downloadable?: boolean;
  createdDate?: string;
}

export interface AppStoreVersionRelationships {
  app?: Relationship<"apps">;
  appStoreVersionLocalizations?: Relationship<"appStoreVersionLocalizations">;
  build?: Relationship<"builds">;
  appStoreVersionPhasedRelease?: Relationship<"appStoreVersionPhasedReleases">;
  routingAppCoverage?: Relationship<"routingAppCoverages">;
  appStoreReviewDetail?: Relationship<"appStoreReviewDetails">;
  appStoreVersionSubmission?: Relationship<"appStoreVersionSubmissions">;
  idfaDeclaration?: Relationship<"idfaDeclarations">;
  appClipDefaultExperience?: Relationship<"appClipDefaultExperiences">;
}

export interface AppStoreVersion {
  type: "appStoreVersions";
  id: string;
  attributes: AppStoreVersionAttributes;
  relationships?: AppStoreVersionRelationships;
  links: ResourceLinks;
}

// ============================================================================
// App Store Version Localization Resources
// ============================================================================

export interface AppStoreVersionLocalizationAttributes {
  description?: string;
  locale: string;
  keywords?: string;
  marketingUrl?: string;
  promotionalText?: string;
  supportUrl?: string;
  whatsNew?: string;
}

export interface AppStoreVersionLocalizationRelationships {
  appStoreVersion?: Relationship<"appStoreVersions">;
  appScreenshotSets?: Relationship<"appScreenshotSets">;
  appPreviewSets?: Relationship<"appPreviewSets">;
}

export interface AppStoreVersionLocalization {
  type: "appStoreVersionLocalizations";
  id: string;
  attributes: AppStoreVersionLocalizationAttributes;
  relationships?: AppStoreVersionLocalizationRelationships;
  links: ResourceLinks;
}

// ============================================================================
// App Info Resources
// ============================================================================

export interface AppInfoAttributes {
  appStoreState?: AppStoreVersionState;
  appStoreAgeRating?: string;
  brazilAgeRating?: string;
  kidsAgeBand?: string;
}

export interface AppInfoRelationships {
  app?: Relationship<"apps">;
  appInfoLocalizations?: Relationship<"appInfoLocalizations">;
  primaryCategory?: Relationship<"appCategories">;
  primarySubcategoryOne?: Relationship<"appCategories">;
  primarySubcategoryTwo?: Relationship<"appCategories">;
  secondaryCategory?: Relationship<"appCategories">;
  secondarySubcategoryOne?: Relationship<"appCategories">;
  secondarySubcategoryTwo?: Relationship<"appCategories">;
}

export interface AppInfo {
  type: "appInfos";
  id: string;
  attributes: AppInfoAttributes;
  relationships?: AppInfoRelationships;
  links: ResourceLinks;
}

// ============================================================================
// App Info Localization Resources
// ============================================================================

export interface AppInfoLocalizationAttributes {
  locale: string;
  name?: string;
  subtitle?: string;
  privacyPolicyUrl?: string;
  privacyChoicesUrl?: string;
  privacyPolicyText?: string;
}

export interface AppInfoLocalizationRelationships {
  appInfo?: Relationship<"appInfos">;
}

export interface AppInfoLocalization {
  type: "appInfoLocalizations";
  id: string;
  attributes: AppInfoLocalizationAttributes;
  relationships?: AppInfoLocalizationRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Build Resources
// ============================================================================

export interface BuildAttributes {
  version: string;
  uploadedDate?: string;
  expirationDate?: string;
  expired?: boolean;
  minOsVersion?: string;
  iconAssetToken?: {
    templateUrl: string;
    width: number;
    height: number;
  };
  processingState?: "PROCESSING" | "FAILED" | "INVALID" | "VALID";
  buildAudienceType?: "INTERNAL_ONLY" | "APP_STORE_ELIGIBLE";
  usesNonExemptEncryption?: boolean;
}

export interface BuildRelationships {
  app?: Relationship<"apps">;
  preReleaseVersion?: Relationship<"preReleaseVersions">;
  betaGroups?: Relationship<"betaGroups">;
  betaBuildLocalizations?: Relationship<"betaBuildLocalizations">;
  appEncryptionDeclaration?: Relationship<"appEncryptionDeclarations">;
  betaAppReviewSubmission?: Relationship<"betaAppReviewSubmissions">;
  buildBetaDetail?: Relationship<"buildBetaDetails">;
  icons?: Relationship<"buildIcons">;
}

export interface Build {
  type: "builds";
  id: string;
  attributes: BuildAttributes;
  relationships?: BuildRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Beta Group Resources
// ============================================================================

export interface BetaGroupAttributes {
  name: string;
  createdDate?: string;
  isInternalGroup?: boolean;
  hasAccessToAllBuilds?: boolean;
  publicLinkEnabled?: boolean;
  publicLinkId?: string;
  publicLinkLimitEnabled?: boolean;
  publicLinkLimit?: number;
  publicLink?: string;
  feedbackEnabled?: boolean;
}

export interface BetaGroupRelationships {
  app?: Relationship<"apps">;
  builds?: Relationship<"builds">;
  betaTesters?: Relationship<"betaTesters">;
}

export interface BetaGroup {
  type: "betaGroups";
  id: string;
  attributes: BetaGroupAttributes;
  relationships?: BetaGroupRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Beta Tester Resources
// ============================================================================

export interface BetaTesterAttributes {
  firstName?: string;
  lastName?: string;
  email?: string;
  inviteType?: "EMAIL" | "PUBLIC_LINK";
  state?: string;
}

export interface BetaTesterRelationships {
  apps?: Relationship<"apps">;
  betaGroups?: Relationship<"betaGroups">;
  builds?: Relationship<"builds">;
}

export interface BetaTester {
  type: "betaTesters";
  id: string;
  attributes: BetaTesterAttributes;
  relationships?: BetaTesterRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Screenshot Resources
// ============================================================================

export interface AppScreenshotSetAttributes {
  screenshotDisplayType: ScreenshotDisplayType;
}

export interface AppScreenshotSetRelationships {
  appStoreVersionLocalization?: Relationship<"appStoreVersionLocalizations">;
  appScreenshots?: Relationship<"appScreenshots">;
}

export interface AppScreenshotSet {
  type: "appScreenshotSets";
  id: string;
  attributes: AppScreenshotSetAttributes;
  relationships?: AppScreenshotSetRelationships;
  links: ResourceLinks;
}

export interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

export interface ImageAsset {
  templateUrl: string;
  width: number;
  height: number;
}

export interface AppScreenshotAttributes {
  fileSize?: number;
  fileName?: string;
  sourceFileChecksum?: string;
  imageAsset?: ImageAsset;
  assetToken?: string;
  assetType?: string;
  uploadOperations?: UploadOperation[];
  assetDeliveryState?: {
    state: "AWAITING_UPLOAD" | "UPLOADING" | "COMPLETE" | "FAILED";
    errors?: Array<{ code: string; description: string }>;
  };
}

export interface AppScreenshotRelationships {
  appScreenshotSet?: Relationship<"appScreenshotSets">;
}

export interface AppScreenshot {
  type: "appScreenshots";
  id: string;
  attributes: AppScreenshotAttributes;
  relationships?: AppScreenshotRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Request Body Types
// ============================================================================

export interface CreateAppStoreVersionRequest {
  data: {
    type: "appStoreVersions";
    attributes: {
      platform: Platform;
      versionString: string;
      copyright?: string;
      releaseType?: ReleaseType;
      earliestReleaseDate?: string;
    };
    relationships: {
      app: {
        data: {
          type: "apps";
          id: string;
        };
      };
    };
  };
}

export interface CreateAppStoreVersionLocalizationRequest {
  data: {
    type: "appStoreVersionLocalizations";
    attributes: {
      locale: string;
      description?: string;
      keywords?: string;
      marketingUrl?: string;
      promotionalText?: string;
      supportUrl?: string;
      whatsNew?: string;
    };
    relationships: {
      appStoreVersion: {
        data: {
          type: "appStoreVersions";
          id: string;
        };
      };
    };
  };
}

export interface UpdateAppStoreVersionLocalizationRequest {
  data: {
    type: "appStoreVersionLocalizations";
    id: string;
    attributes: {
      description?: string;
      keywords?: string;
      marketingUrl?: string;
      promotionalText?: string;
      supportUrl?: string;
      whatsNew?: string;
    };
  };
}

export interface UpdateAppInfoLocalizationRequest {
  data: {
    type: "appInfoLocalizations";
    id: string;
    attributes: {
      name?: string;
      subtitle?: string;
      privacyPolicyUrl?: string;
      privacyChoicesUrl?: string;
      privacyPolicyText?: string;
    };
  };
}

export interface CreateBetaTesterRequest {
  data: {
    type: "betaTesters";
    attributes: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
    relationships: {
      betaGroups: {
        data: Array<{
          type: "betaGroups";
          id: string;
        }>;
      };
    };
  };
}

export interface CreateAppScreenshotRequest {
  data: {
    type: "appScreenshots";
    attributes: {
      fileName: string;
      fileSize: number;
    };
    relationships: {
      appScreenshotSet: {
        data: {
          type: "appScreenshotSets";
          id: string;
        };
      };
    };
  };
}

export interface UpdateAppScreenshotRequest {
  data: {
    type: "appScreenshots";
    id: string;
    attributes: {
      sourceFileChecksum: string;
      uploaded: boolean;
    };
  };
}

// ============================================================================
// Bundle ID Resources
// ============================================================================

export interface BundleIdAttributes {
  name: string;
  identifier: string;
  platform: Platform;
  seedId?: string;
}

export interface BundleIdRelationships {
  app?: Relationship<"apps">;
  bundleIdCapabilities?: Relationship<"bundleIdCapabilities">;
  profiles?: Relationship<"profiles">;
}

export interface BundleId {
  type: "bundleIds";
  id: string;
  attributes: BundleIdAttributes;
  relationships?: BundleIdRelationships;
  links: ResourceLinks;
}

export interface CreateBundleIdRequest {
  data: {
    type: "bundleIds";
    attributes: {
      identifier: string;
      name: string;
      platform: Platform;
    };
  };
}

export interface UpdateBundleIdRequest {
  data: {
    type: "bundleIds";
    id: string;
    attributes: {
      name: string;
    };
  };
}

// ============================================================================
// Device Resources
// ============================================================================

export type DeviceClass = "APPLE_WATCH" | "IPAD" | "IPHONE" | "IPOD" | "APPLE_TV" | "MAC";

export type DeviceStatus = "ENABLED" | "DISABLED";

export interface DeviceAttributes {
  name: string;
  platform: Platform;
  udid: string;
  deviceClass: DeviceClass;
  status: DeviceStatus;
  model?: string;
  addedDate?: string;
}

export interface Device {
  type: "devices";
  id: string;
  attributes: DeviceAttributes;
  links: ResourceLinks;
}

// ============================================================================
// User Resources
// ============================================================================

export type UserRole =
  | "ADMIN"
  | "FINANCE"
  | "TECHNICAL"
  | "SALES"
  | "DEVELOPER"
  | "MARKETING"
  | "APP_MANAGER"
  | "CUSTOMER_SUPPORT"
  | "ACCESS_TO_REPORTS"
  | "READ_ONLY";

export interface UserAttributes {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  roles: UserRole[];
  allAppsVisible?: boolean;
  provisioningAllowed?: boolean;
}

export interface UserRelationships {
  visibleApps?: Relationship<"apps">;
}

export interface User {
  type: "users";
  id: string;
  attributes: UserAttributes;
  relationships?: UserRelationships;
  links: ResourceLinks;
}

// ============================================================================
// App Category Resources
// ============================================================================

export interface AppCategoryAttributes {
  platforms: Platform[];
}

export interface AppCategoryRelationships {
  subcategories?: Relationship<"appCategories">;
  parent?: Relationship<"appCategories">;
}

export interface AppCategory {
  type: "appCategories";
  id: string;
  attributes: AppCategoryAttributes;
  relationships?: AppCategoryRelationships;
  links: ResourceLinks;
}

// ============================================================================
// App Price Schedule Resources
// ============================================================================

export type AppPriceScheduleAttributes = Record<string, never>;

export interface AppPriceScheduleRelationships {
  app?: Relationship<"apps">;
  baseTerritory?: Relationship<"territories">;
  manualPrices?: Relationship<"appPrices">;
  automaticPrices?: Relationship<"appPrices">;
}

export interface AppPriceSchedule {
  type: "appPriceSchedules";
  id: string;
  attributes?: AppPriceScheduleAttributes;
  relationships?: AppPriceScheduleRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Territory Resources
// ============================================================================

export interface TerritoryAttributes {
  currency: string;
}

export interface Territory {
  type: "territories";
  id: string;
  attributes: TerritoryAttributes;
  links?: ResourceLinks;
}

// ============================================================================
// App Availability Resources
// ============================================================================

export interface AppAvailabilityAttributes {
  availableInNewTerritories: boolean;
}

export interface AppAvailabilityRelationships {
  app?: Relationship<"apps">;
  availableTerritories?: Relationship<"territories">;
}

export interface AppAvailability {
  type: "appAvailabilities";
  id: string;
  attributes: AppAvailabilityAttributes;
  relationships?: AppAvailabilityRelationships;
  links: ResourceLinks;
}

// ============================================================================
// Beta Tester Invitation Resources
// ============================================================================

export type BetaTesterInvitationAttributes = Record<string, never>;

export interface BetaTesterInvitation {
  type: "betaTesterInvitations";
  id: string;
  attributes?: BetaTesterInvitationAttributes;
  links: ResourceLinks;
}

// ============================================================================
// Additional Request Body Types
// ============================================================================

export interface RemoveBetaTestersRequest {
  data: Array<{
    type: "betaTesters";
    id: string;
  }>;
}
