
import { LoaderCircle } from "lucide-react";
import type {
  ChatMessage,
  FinalResponsePayload,
  FinalResponseSection,
} from "@/lib/types";
import Image from "next/image";
import { getProductImage, getProductMeta } from "@/lib/format";

export function AssistantMessageBody({
  message,
  activeRecommendationMessageId,
  activeOutfitIndex,
  onSelectOutfit,
  recommendationSurface,
}: {
  message: ChatMessage;
  activeRecommendationMessageId: string | null;
  activeOutfitIndex: number;
  onSelectOutfit: (messageId: string, outfitIndex: number) => void;
  recommendationSurface: "panel" | "modal";
}) {
  const payload = message.final_response_payload;
  const assistantTextClassName =
    "max-w-4xl whitespace-pre-wrap text-[15px] leading-8 font-medium tracking-[0.01em] text-[var(--text)]";

  function getTextParagraphs(text: string | null | undefined) {
    return (text ?? "")
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  }

  if (!payload) {
    return (
      <div className="space-y-3">
        {getTextParagraphs(message.content).map((paragraph, index) => (
          <p
            key={`${message.id}-${index}`}
            className={assistantTextClassName}
          >
            {paragraph}
          </p>
        ))}
        {message.pending ? (
          <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
            <LoaderCircle size={14} className="animate-spin" />
            The assistant is thinking...
          </div>
        ) : null}
      </div>
    );
  }

  const rawSections: FinalResponseSection[] =
    payload.sections.length > 0
      ? payload.sections
      : [{ type: "text" as const, content: message.content, title: null }];

  const sections = rawSections.reduce<FinalResponseSection[]>((deduped, section) => {
    if (
      section.type === "product_highlights" ||
      section.type === "garment_recommendations"
    ) {
      return deduped.some(
        (dedupedSection) =>
          dedupedSection.type === "product_highlights" ||
          dedupedSection.type === "garment_recommendations",
      )
        ? deduped
        : [...deduped, section];
    }

    if (section.type === "outfit_recommendations") {
      return deduped.some(
        (dedupedSection) => dedupedSection.type === "outfit_recommendations",
      )
        ? deduped
        : [...deduped, section];
    }

    return [...deduped, section];
  }, []);

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        if (section.type === "text" && section.content) {
          return (
            <div key={`${message.id}-text-${index}`} className="space-y-3">
              {getTextParagraphs(section.content).map(
                (paragraph, paragraphIndex) => (
                  <p
                    key={`${message.id}-text-${index}-${paragraphIndex}`}
                    className={assistantTextClassName}
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </div>
          );
        }

        if (
          section.type === "product_highlights" ||
          section.type === "garment_recommendations"
        ) {
          return (
            <ProductHighlightsSection
              key={`${message.id}-products-${index}`}
              payload={payload}
              title={section.title || "Featured products"}
            />
          );
        }

        if (section.type === "outfit_recommendations") {
          return (
            <OutfitRecommendationsSection
              key={`${message.id}-outfits-${index}`}
              messageId={message.id}
              payload={payload}
              title={section.title || "Recommended outfits"}
              activeRecommendationMessageId={activeRecommendationMessageId}
              activeOutfitIndex={activeOutfitIndex}
              onSelectOutfit={onSelectOutfit}
              recommendationSurface={recommendationSurface}
            />
          );
        }

        return null;
      })}

      {message.pending ? (
        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
          <LoaderCircle size={14} className="animate-spin" />
          The assistant is thinking...
        </div>
      ) : null}
    </div>
  );
}

function ProductHighlightsSection({
  payload,
}: {
  payload: FinalResponsePayload;
  title: string;
}) {
  const groups = payload.recommendations.product_highlights ?? [];

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(32,31,31,0.62)] p-4">
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={`${group.group_label}-${group.products[0]?.id ?? "empty"}`}
            className="space-y-3 rounded-[1.15rem] bg-[var(--surface-low)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text)]">{group.group_label}</p>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                {group.products.length} picks
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {group.products.map((product, itemIndex) => {
                const image = getProductImage(product);
                return (
                  <article
                    key={`${group.group_label}-${product.id}-${itemIndex}`}
                    className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
                  >
                    {image ? (
                      <Image
                        alt={product.product_display_name || group.group_label}
                        className="aspect-[4/5] w-full rounded-[0.95rem] object-cover"
                        src={image}
                        width={240}
                        height={300}
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center rounded-[0.95rem] bg-[var(--surface-high)] text-center text-[11px] text-[var(--muted)]">
                        No image
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {product.product_display_name || group.group_label}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--muted)]">
                        {group.group_label}
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                        {getProductMeta(product)}
                      </p>
                      {product.price !== null && product.price !== undefined ? (
                        <div className="mt-3 text-xs font-semibold text-[var(--text)]">
                          ${product.price.toFixed(2)}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OutfitRecommendationsSection({
  messageId,
  payload,
  activeRecommendationMessageId,
  activeOutfitIndex,
  onSelectOutfit,
  recommendationSurface,
}: {
  messageId: string;
  payload: FinalResponsePayload;
  title: string;
  activeRecommendationMessageId: string | null;
  activeOutfitIndex: number;
  onSelectOutfit: (messageId: string, outfitIndex: number) => void;
  recommendationSurface: "panel" | "modal";
}) {
  if (payload.recommendations.outfits.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(32,31,31,0.62)] p-4">
      <div className="grid gap-3">
        {payload.recommendations.outfits.map((outfit, index) => {
          const isSelected =
            activeRecommendationMessageId === messageId && activeOutfitIndex === index;

          return (
            <button
              key={`${messageId}-outfit-${index}`}
              type="button"
              className={`rounded-[1.4rem] border p-4 text-left transition ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-high)]"
              }`}
              onClick={() => onSelectOutfit(messageId, index)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="mt-2 text-base font-semibold text-[var(--text)]">
                    {outfit.summary_label}
                  </h4>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {outfit.items.map((item, itemIndex) => (
                  <span
                    key={`${messageId}-outfit-chip-${index}-${itemIndex}`}
                    className="rounded-full bg-[var(--surface-high)] px-3 py-1 text-xs text-[var(--muted)]"
                  >
                    {item.summary_label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
