"use client";

import Image from "next/image";
import { startTransition, useEffect, useState } from "react";
import { ArrowUp, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import { ApiError, getConversation, listMessages, sendMessage } from "@/lib/api-client";
import { formatShortDate, formatShortTime } from "@/lib/format";
import { readPreferences } from "@/lib/storage";
import type { ChatMessage, Conversation, FinalResponsePayload, ProductRecommendation } from "@/lib/types";

type ChatWorkspaceProps = {
  conversationId: string;
};

function getRoleOrder(role: string) {
  if (role === "user") {
    return 0;
  }
  if (role === "assistant") {
    return 1;
  }
  return 2;
}

function sortMessagesChronologically(items: ChatMessage[]) {
  return [...items].sort((left, right) => {
    const timeDifference = Date.parse(left.created_at) - Date.parse(right.created_at);
    if (timeDifference !== 0) {
      return timeDifference;
    }

    const roleDifference = getRoleOrder(left.role) - getRoleOrder(right.role);
    if (roleDifference !== 0) {
      return roleDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

function getProductImage(product: ProductRecommendation | null | undefined) {
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

function getProductMeta(product: ProductRecommendation | null | undefined) {
  if (!product) {
    return "No precise match yet";
  }

  return (
    [product.brand, product.base_colour, product.article_type]
      .filter(Boolean)
      .join(" - ") || "Curated selection"
  );
}

function getTextParagraphs(text: string | null | undefined) {
  return (text ?? "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function ChatWorkspace({ conversationId }: ChatWorkspaceProps) {
  const auth = useAuth();
  const router = useRouter();
  const { createConversation, refreshConversations } = useConversations();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecommendationPanel, setShowRecommendationPanel] = useState(
    () => readPreferences().showRecommendationPanel,
  );
  const [selectedOutfitState, setSelectedOutfitState] = useState<{
    messageId: string | null;
    outfitIndex: number;
  }>({
    messageId: null,
    outfitIndex: 0,
  });

  useEffect(() => {
    function syncPreferences() {
      setShowRecommendationPanel(readPreferences().showRecommendationPanel);
    }

    window.addEventListener("preferences:changed", syncPreferences);
    return () => window.removeEventListener("preferences:changed", syncPreferences);
  }, []);

  useEffect(() => {
    async function loadConversation() {
      if (!auth.token) {
        return;
      }

      if (conversationId === "new") {
        setConversation(null);
        setMessages([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [currentConversation, currentMessages] = await Promise.all([
          getConversation(auth.token, conversationId),
          listMessages(auth.token, conversationId),
        ]);
        setConversation(currentConversation);
        setMessages(sortMessagesChronologically(currentMessages));
      } catch (caughtError) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "We could not load the selected conversation.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadConversation();
  }, [auth.token, conversationId]);

  const latestRecommendationMessage = [...messages].reverse().find(
    (message) =>
      message.role === "assistant" &&
      (message.final_response_payload?.recommendations.outfits.length ?? 0) > 0,
  );

  const selectedRecommendationMessage = messages.find(
    (message) =>
      message.id === selectedOutfitState.messageId &&
      (message.final_response_payload?.recommendations.outfits.length ?? 0) > 0,
  );
  const hasValidSelectedOutfit =
    !!selectedRecommendationMessage?.final_response_payload &&
    selectedOutfitState.outfitIndex <
      selectedRecommendationMessage.final_response_payload.recommendations.outfits.length;

  const activeRecommendationMessage =
    (hasValidSelectedOutfit ? selectedRecommendationMessage : null) ??
    latestRecommendationMessage ??
    null;
  const activeRecommendationPayload = activeRecommendationMessage?.final_response_payload ?? null;
  const activeOutfitIndex =
    hasValidSelectedOutfit && activeRecommendationMessage?.id === selectedRecommendationMessage?.id
      ? selectedOutfitState.outfitIndex
      : 0;

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !auth.token || sending) {
      return;
    }

    setSending(true);
    setError(null);
    setDraft("");

    const optimisticUserMessage: ChatMessage = {
      id: `pending-user-${Date.now()}`,
      conversation_id: conversation?.id ?? "new",
      role: "user",
      content: trimmed,
      final_response_payload: null,
      workflow_errors: null,
      created_at: new Date().toISOString(),
      pending: true,
    };

    const optimisticAssistantMessage: ChatMessage = {
      id: `pending-assistant-${Date.now()}`,
      conversation_id: conversation?.id ?? "new",
      role: "assistant",
      content: "",
      final_response_payload: null,
      workflow_errors: null,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((current) => [...current, optimisticUserMessage, optimisticAssistantMessage]);

    try {
      let activeConversation = conversation;
      if (conversationId === "new" || !activeConversation) {
        activeConversation = await createConversation(trimmed.slice(0, 60));
        setConversation(activeConversation);
      }

      const response = await sendMessage(auth.token, activeConversation.id, trimmed);

      setMessages((current) => {
        const withoutPending = current.filter((message) => !message.pending);
        return sortMessagesChronologically([
          ...withoutPending,
          response.user_message,
          response.assistant_message,
        ]);
      });

      await refreshConversations();

      if (conversationId === "new") {
        startTransition(() => {
          router.replace(`/chat/${activeConversation.id}`);
        });
      }
    } catch (caughtError) {
      setMessages((current) => current.filter((message) => !message.pending));
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not send your message to the assistant.",
      );
    } finally {
      setSending(false);
    }
  }

  function handleSelectOutfit(messageId: string, outfitIndex: number) {
    setSelectedOutfitState({ messageId, outfitIndex });
  }

  return (
    <section className="grid min-h-[calc(100vh-2rem)] gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:pt-4">
      <div className="glass-strong hairline soft-shadow flex min-h-[75vh] flex-col rounded-[2rem]">
        <div
          className={`thread-fade scroll-muted flex-1 overflow-y-auto px-5 py-6 sm:px-8 ${
            !loading && !error && messages.length === 0
              ? "flex items-center justify-center"
              : ""
          }`}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="inline-flex items-center gap-3 rounded-full bg-white/70 px-5 py-3 text-sm text-[var(--muted)]">
                <LoaderCircle size={16} className="animate-spin" />
                Loading conversation...
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-[1.4rem] border border-[rgba(186,26,26,0.16)] bg-[rgba(255,234,229,0.8)] px-5 py-4 text-sm text-[#8c2616]">
              {error}
            </div>
          ) : null}

          {!loading && !error && messages.length === 0 ? (
            <div className="animate-rise-in rounded-[1.8rem] border border-dashed border-[var(--line-strong)] bg-white/55 p-8 text-center">
              <div className="flex items-center justify-center gap-3 text-[var(--text)]">
                <Sparkles size={30} className="shrink-0 text-[var(--accent)]" />
                <h2 className="serif text-4xl leading-none">
                  Describe the look, occasion, or garment.
                </h2>
              </div>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                For example: an outfit for a formal event, monochrome pieces, or
                a specific business and policy question.
              </p>
            </div>
          ) : null}

          {!loading && !error && messages.length > 0 ? (
            <div className="space-y-6">
              <div className="flex justify-center">
                <span className="rounded-full bg-white/70 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                  {formatShortDate(messages[messages.length - 1].created_at)}
                </span>
              </div>

              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`animate-rise-in flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-3xl rounded-[1.6rem] px-5 py-4 ${isUser ? "bg-[var(--text)] text-[var(--accent-ink)]" : "border border-[var(--line)] bg-white/75 text-[var(--text)]"}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.26em] opacity-70">
                        <span>{isUser ? "You" : "Stylist AI"}</span>
                        <span>{formatShortTime(message.created_at)}</span>
                      </div>

                      {isUser ? (
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </p>
                      ) : (
                        <AssistantMessageBody
                          message={message}
                          activeRecommendationMessageId={activeRecommendationMessage?.id ?? null}
                          activeOutfitIndex={activeOutfitIndex}
                          onSelectOutfit={handleSelectOutfit}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <form
          className="border-t border-[var(--line)] px-5 py-5 sm:px-8"
          onSubmit={handleSend}
        >
          <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/70 p-3 shadow-[0_18px_40px_rgba(76,47,26,0.08)]">
            <div className="flex items-end gap-3">
              <button
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)]"
                type="button"
                onClick={() => router.push("/chat/new")}
                aria-label="New conversation"
              >
                <Plus size={18} />
              </button>

              <textarea
                className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-7 outline-none placeholder:text-[var(--muted)]"
                placeholder="Write your message to the stylist..."
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />

              <button
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={sending || !draft.trim()}
                type="submit"
                aria-label="Send message"
              >
                {sending ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showRecommendationPanel ? (
        <aside className="glass-strong hairline soft-shadow hidden min-h-[75vh] flex-col rounded-[2rem] lg:flex">
          <div className="border-b border-[var(--line)] px-6 py-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
              Recommendation panel
            </p>
          </div>

          <div className="scroll-muted flex-1 space-y-6 overflow-y-auto p-6">
            {!activeRecommendationPayload ||
            activeRecommendationPayload.recommendations.outfits.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-[var(--line-strong)] bg-white/60 p-5 text-sm leading-7 text-[var(--muted)]">
                Full outfit suggestions will appear here as soon as the
                assistant recommends a complete look.
              </div>
            ) : (
              <RecommendationContent
                payload={activeRecommendationPayload}
                selectedOutfitIndex={activeOutfitIndex}
                onSelectOutfit={(outfitIndex) =>
                  handleSelectOutfit(activeRecommendationMessage?.id ?? "", outfitIndex)
                }
              />
            )}
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function AssistantMessageBody({
  message,
  activeRecommendationMessageId,
  activeOutfitIndex,
  onSelectOutfit,
}: {
  message: ChatMessage;
  activeRecommendationMessageId: string | null;
  activeOutfitIndex: number;
  onSelectOutfit: (messageId: string, outfitIndex: number) => void;
}) {
  const payload = message.final_response_payload;

  if (!payload) {
    return (
      <div className="space-y-3">
        {getTextParagraphs(message.content).map((paragraph, index) => (
          <p
            key={`${message.id}-${index}`}
            className="whitespace-pre-wrap text-sm leading-7"
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

  const sections =
    payload.sections.length > 0
      ? payload.sections
      : [{ type: "text" as const, content: message.content, title: null }];

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        if (section.type === "text" && section.content) {
          return (
            <div key={`${message.id}-text-${index}`} className="space-y-3">
              {getTextParagraphs(section.content).map((paragraph, paragraphIndex) => (
                <p
                  key={`${message.id}-text-${index}-${paragraphIndex}`}
                  className="whitespace-pre-wrap text-sm leading-7"
                >
                  {paragraph}
                </p>
              ))}
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
  title,
}: {
  payload: FinalResponsePayload;
  title: string;
}) {
  const groups = payload.recommendations.product_highlights ?? [];

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Products
        </p>
        <h3 className="mt-2 serif text-2xl leading-none">{title}</h3>
      </div>

      {groups.map((group) => (
        <div
          key={`${group.group_label}-${group.products[0]?.id ?? "empty"}`}
          className="space-y-3 rounded-[1.4rem] border border-[var(--line)] bg-white/68 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)]">{group.group_label}</p>
            <span className="rounded-full bg-[rgba(143,79,43,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {group.products.length} picks
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {group.products.map((product, itemIndex) => {
              const image = getProductImage(product);
              return (
                <article
                  key={`${group.group_label}-${product.id}-${itemIndex}`}
                  className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 rounded-[1.1rem] bg-[rgba(143,79,43,0.06)] p-3"
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
                    <div className="flex aspect-[4/5] items-center justify-center rounded-[0.95rem] bg-white/70 text-center text-[11px] text-[var(--muted)]">
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
    </section>
  );
}

function OutfitRecommendationsSection({
  messageId,
  payload,
  title,
  activeRecommendationMessageId,
  activeOutfitIndex,
  onSelectOutfit,
}: {
  messageId: string;
  payload: FinalResponsePayload;
  title: string;
  activeRecommendationMessageId: string | null;
  activeOutfitIndex: number;
  onSelectOutfit: (messageId: string, outfitIndex: number) => void;
}) {
  if (payload.recommendations.outfits.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Outfits
        </p>
        <h3 className="mt-2 serif text-2xl leading-none">{title}</h3>
      </div>

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
                  ? "border-[var(--text)] bg-[rgba(143,79,43,0.12)]"
                  : "border-[var(--line)] bg-white/72 hover:border-[var(--line-strong)]"
              }`}
              onClick={() => onSelectOutfit(messageId, index)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    Look {index + 1}
                  </p>
                  <h4 className="mt-2 text-base font-semibold text-[var(--text)]">
                    {outfit.summary_label}
                  </h4>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                    isSelected
                      ? "bg-[var(--text)] text-[var(--accent-ink)]"
                      : "bg-[rgba(143,79,43,0.08)] text-[var(--muted)]"
                  }`}
                >
                  {isSelected ? "Open in panel" : "View outfit"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {outfit.items.map((item, itemIndex) => (
                  <span
                    key={`${messageId}-outfit-chip-${index}-${itemIndex}`}
                    className="rounded-full bg-[rgba(143,79,43,0.08)] px-3 py-1 text-xs text-[var(--muted)]"
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

function RecommendationContent({
  payload,
  selectedOutfitIndex,
  onSelectOutfit,
}: {
  payload: FinalResponsePayload;
  selectedOutfitIndex: number;
  onSelectOutfit: (outfitIndex: number) => void;
}) {
  const outfits = payload.recommendations.outfits;
  const selectedOutfit = outfits[selectedOutfitIndex] ?? outfits[0];

  if (!selectedOutfit) {
    return null;
  }

  return (
    <>
      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
            Outfits
          </p>
          <h3 className="mt-2 serif text-2xl leading-none">Suggested combinations</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {outfits.map((outfit, index) => (
            <button
              key={`${outfit.summary_label}-${index}`}
              type="button"
              className={`rounded-full px-4 py-2 text-sm transition ${
                index === selectedOutfitIndex
                  ? "bg-[var(--text)] text-[var(--accent-ink)]"
                  : "bg-white/72 text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => onSelectOutfit(index)}
            >
              Look {index + 1}
            </button>
          ))}
        </div>
      </section>

      <article className="space-y-4 rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Look {selectedOutfitIndex + 1}
          </p>
          <h4 className="mt-2 serif text-3xl leading-none">
            {selectedOutfit.summary_label}
          </h4>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {selectedOutfit.items.map((item) => item.summary_label).join(" - ")}
          </p>
        </div>

        <div className="space-y-3">
          {selectedOutfit.items.map((item, itemIndex) => {
            const image = getProductImage(item.best_match);

            return (
              <article
                key={`${selectedOutfit.summary_label}-${itemIndex}`}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-[1.25rem] bg-[rgba(143,79,43,0.06)] p-3"
              >
                {image ? (
                  <Image
                    alt={item.best_match?.product_display_name || item.summary_label}
                    className="aspect-[4/5] w-full rounded-[1rem] object-cover"
                    src={image}
                    width={280}
                    height={350}
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center rounded-[1rem] bg-white/70 text-center text-[11px] text-[var(--muted)]">
                    No image
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {item.summary_label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                    {item.best_match?.product_display_name || "No precise match yet"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                    {getProductMeta(item.best_match)}
                  </p>
                  {item.best_match?.price !== null && item.best_match?.price !== undefined ? (
                    <div className="mt-3 text-xs font-semibold text-[var(--text)]">
                      ${item.best_match.price.toFixed(2)}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </article>
    </>
  );
}
