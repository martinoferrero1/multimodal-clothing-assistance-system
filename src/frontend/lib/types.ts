export type User = {
  id: string;
  display_name: string;
  email: string | null;
  search_preferences: SearchPreferences;
  created_at: string;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
  expires_at: string;
};

export type AuthResponse = {
  token: AuthToken;
  user: User;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  search_preferences: ConversationSearchPreferences;
  message_count: number;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
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
};

export type ChatTurnResponse = {
  conversation_id: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export type HealthResponse = {
  status: string;
};

export type AuthSession = {
  token: AuthToken;
  user: User;
};

export type SettingsPreferences = {
  compactSidebar: boolean;
  showRecommendationPanel: boolean;
};
