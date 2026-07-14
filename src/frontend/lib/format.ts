import type { ChatMessage, Conversation, ProductRecommendation } from "@/lib/types";

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatShortTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeDay(value: string): string {
  const target = new Date(value);
  const now = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((currentDay - targetDay) / 86400000);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return "This week";
  }

  if (diffDays < 14) {
    return "Last week";
  }

  return "Older";
}

export function buildConversationTitle(conversation: Conversation): string {
  if (conversation.title.trim()) {
    return conversation.title;
  }

  return "New conversation";
}

export function getMessagePreview(message: ChatMessage): string {
  const text = message.content.replace(/\s+/g, " ").trim();
  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 137)}...`;
}

export function getRenderableAssistantParagraphs(message: ChatMessage): string[] {
  const textSections = message.final_response_payload?.sections
    .filter((section) => section.type === "text" && section.content)
    .map((section) => section.content?.trim() ?? "")
    .filter(Boolean);

  if (textSections && textSections.length > 0) {
    return textSections;
  }

  return message.content
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function getProductImage(product: ProductRecommendation | null | undefined) {
  if (!product) {
    return null;
  }

  return (
    product.images.default ||
    product.images.front ||
    product.images.search ||
    product.images.top ||
    null
  );
}

export function getProductMeta(product: ProductRecommendation | null | undefined) {
  if (!product) {
    return "No precise match yet";
  }

  return (
    [product.brand, product.base_colour, product.article_type]
      .filter(Boolean)
      .join(" - ") || "Curated selection"
  );
}
