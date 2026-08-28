import type { Language } from "@/lib/i18n";

export type User = {
  id: string;
  display_name: string;
  email: string | null;
  search_preferences: SearchPreferences;
  style_preferences: UserStylePreferences;
  created_at: string;
};

export type AuthResponse = {
  user: User;
  csrf_token: string;
  selected_store: SelectedStoreStatus | null;
};

export type StoreLifecycle = "pending" | "active" | "rejected" | "suspended";

// This is intentionally limited to the store bound to the current session.
export type SelectedStoreStatus = {
  id: string;
  display_name: string;
  handle: string;
  status: StoreLifecycle;
  email_verified: boolean;
  mfa_enrolled: boolean;
  mfa_confirmed: boolean;
};

export type StoreStatusResponse = {
  selected_store: SelectedStoreStatus | null;
};

export type StoreRegistrationRequest = {
  owner_display_name: string;
  owner_email: string;
  owner_password: string;
  legal_name: string;
  display_name: string;
  handle: string;
  jurisdiction: string;
  business_identifier: string;
  address: string;
  contact_email: string;
  contact_phone: string;
};

export type MfaEnrollmentResponse = {
  provisioning_uri: string;
};

export type StoreInventoryItemWrite = {
  external_id: string;
  product_display_name: string;
  price?: number | null;
  gender?: string | null;
  master_category?: string | null;
  sub_category?: string | null;
  article_type?: string | null;
  base_colour?: string | null;
  colour1?: string | null;
  colour2?: string | null;
  season?: string | null;
  year?: number | null;
  usage?: string | null;
  brand?: string | null;
  description?: string | null;
  details?: Record<string, unknown>;
  image_top?: string | null;
  image_back?: string | null;
  image_search?: string | null;
  image_default?: string | null;
  image_left?: string | null;
  image_front?: string | null;
  image_right?: string | null;
};

export type StoreInventoryItem = StoreInventoryItemWrite & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type StoreInventoryImportResponse = {
  created_count: number;
  updated_count: number;
  total_count: number;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  is_pinned: boolean;
  summary: string | null;
  search_preferences: ConversationSearchPreferences;
  style_preferences: ConversationStylePreferences;
  message_count: number;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationUpdate = {
  title?: string;
  is_pinned?: boolean;
};

export type SearchPriorityField =
  | "gender"
  | "season"
  | "base_colors"
  | "secondary_colors"
  | "max_price"
  | "category";

export type SearchPreferences = {
  priority_fields: SearchPriorityField[];
};

export type ConversationSearchPreferences = {
  priority_fields: SearchPriorityField[] | null;
  effective_priority_fields: SearchPriorityField[];
};

export type StylePreferenceDetails = {
  liked_styles: string[];
  disliked_styles: string[];
  preferred_colors: string[];
  avoided_colors: string[];
  preferred_brands: string[];
  avoided_brands: string[];
  preferred_fits: string[];
  occasions: string[];
  budget_notes: string | null;
  sizing_notes: string | null;
  freeform_notes: string | null;
};

export type InferredStylePreference = {
  id: string;
  kind: string;
  value: string;
  confidence: number;
  evidence: string | null;
  created_at: string | null;
  updated_at: string | null;
  source: string | null;
  field: string | null;
  polarity: string | null;
  occurrence_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  score: number | null;
  aggregate_id: string | null;
};

export type UserStylePreferences = {
  use_personalized_styles: boolean;
  explicit: StylePreferenceDetails;
  inferred: InferredStylePreference[];
};

export type ConversationStylePreferences = {
  use_personalized_styles: boolean | null;
  effective_use_personalized_styles: boolean;
  temporary: StylePreferenceDetails;
};

export type UserStylePreferencesUpdate = {
  use_personalized_styles?: boolean | null;
  explicit?: Partial<StylePreferenceDetails> | null;
};

export type ConversationStylePreferencesUpdate = {
  use_personalized_styles?: boolean | null;
  temporary?: Partial<StylePreferenceDetails> | null;
};

export type ProductRecommendation = {
  id: number;
  product_display_name: string;
  score: number;
  price: number | null;
  year: number | null;
  usage: string | null;
  gender: string | null;
  master_category: string | null;
  sub_category: string | null;
  article_type: string | null;
  brand: string | null;
  season: string | null;
  base_colour: string | null;
  colour1: string | null;
  colour2: string | null;
  images: Record<string, string | null>;
};

export type GarmentRecommendation = {
  kind: "garment";
  summary_label: string;
  garment_type_label: string;
  best_match: ProductRecommendation | null;
  product_highlights: ProductRecommendation[];
};

export type OutfitRecommendation = {
  kind: "outfit";
  summary_label: string;
  items: GarmentRecommendation[];
};

export type ProductHighlightGroup = {
  group_label: string;
  products: ProductRecommendation[];
};

export type FinalResponseSection = {
  type: "text" | "outfit_recommendations" | "garment_recommendations" | "product_highlights";
  content?: string | null;
  title?: string | null;
};

export type FinalResponsePayload = {
  message: string;
  sections: FinalResponseSection[];
  recommendations: {
    garments: GarmentRecommendation[];
    outfits: OutfitRecommendation[];
    product_highlights: ProductHighlightGroup[];
  };
  business_answer_texts: string[];
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | string;
  content: string;
  attachments: MessageImageAttachment[] | null;
  final_response_payload: FinalResponsePayload | null;
  workflow_errors: Array<Record<string, unknown>> | null;
  created_at: string;
  pending?: boolean;
};

export type MessageImageAttachment = {
  id: string;
  filename: string;
  content_type: string;
  data_url: string;
  description: string | null;
  analysis: ImageAnalysisResult | null;
};

export type GarmentVisualFeatures = {
  garment_type: string | null;
  dominant_colors: string[];
  secondary_colors: string[];
  gender_presentation: string | null;
  style: string | null;
  usage: string | null;
  season: string | null;
  pattern: string | null;
  material: string | null;
  fit: string | null;
  notable_details: string[];
  brand_or_logo_text: string | null;
};

export type ImageAnalysisResult = {
  image_type:
    | "single_garment"
    | "outfit"
    | "multiple_garments"
    | "non_fashion"
    | "unclear";
  garments: GarmentVisualFeatures[];
  summary: string;
};

export type ChatTurnResponse = {
  conversation_id: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export type HealthResponse = {
  status: string;
};

export type SettingsPreferences = {
  compactSidebar: boolean;
  showRecommendationPanel: boolean;
  language: Language;
};
