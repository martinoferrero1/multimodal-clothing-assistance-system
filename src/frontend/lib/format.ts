import type { ChatMessage, Conversation, ProductRecommendation } from "@/lib/types";
import type { Language, Translator } from "@/lib/i18n";
import { languageLocale } from "@/lib/i18n";

export function formatShortDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(languageLocale(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatShortTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(languageLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeDay(value: string, t: Translator): string {
  const target = new Date(value);
  const now = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((currentDay - targetDay) / 86400000);

  if (diffDays === 0) {
    return t("date.today");
  }

  if (diffDays === 1) {
    return t("date.yesterday");
  }

  if (diffDays < 7) {
    return t("date.thisWeek");
  }

  if (diffDays < 14) {
    return t("date.lastWeek");
  }

  return t("date.older");
}

export function buildConversationTitle(conversation: Conversation, fallback: string): string {
  if (conversation.title.trim()) {
    return conversation.title;
  }

  return fallback;
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

export function getProductMeta(
  product: ProductRecommendation | null | undefined,
  noMatch: string,
  curatedSelection: string,
) {
  if (!product) {
    return noMatch;
  }

  return (
    [product.brand, product.base_colour, product.article_type]
      .filter(Boolean)
      .join(" - ") || curatedSelection
  );
}

export function formatPrice(value: number, language: Language): string {
  return new Intl.NumberFormat(languageLocale(language), {
    style: "currency",
    currency: "USD",
  }).format(value);
}
