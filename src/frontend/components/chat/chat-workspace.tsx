"use client";

import Image from "next/image";
import { startTransition, useEffect, useState } from "react";
import { ArrowUp, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import { ApiError, getConversation, listMessages, sendMessage } from "@/lib/api-client";
import {
  buildConversationTitle,
  formatShortDate,
  formatShortTime,
  getRenderableAssistantParagraphs,
} from "@/lib/format";
import { readPreferences } from "@/lib/storage";
import type { ChatMessage, Conversation, FinalResponsePayload, ProductRecommendation } from "@/lib/types";

type ChatWorkspaceProps = {
  conversationId: string;
};

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
        setMessages(currentMessages);
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

  const latestPayload = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.final_response_payload)?.final_response_payload;

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
        return [...withoutPending, response.user_message, response.assistant_message];
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
                const assistantParagraphs = isUser
                  ? []
                  : getRenderableAssistantParagraphs(message);

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
                        <div className="space-y-3">
                          {assistantParagraphs.map((paragraph, index) => (
                            <p
                              key={`${message.id}-${index}`}
                              className="whitespace-pre-wrap text-sm leading-7"
                            >
                              {paragraph}
                            </p>
                          ))}
                          {message.pending ? (
                            <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                              The assistant is thinking...
                            </div>
                          ) : null}
                        </div>
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
            {!latestPayload ? (
              <div className="rounded-[1.6rem] border border-dashed border-[var(--line-strong)] bg-white/60 p-5 text-sm leading-7 text-[var(--muted)]">
                As soon as the response includes recommendations, they will
                appear in this panel.
              </div>
            ) : (
              <RecommendationContent payload={latestPayload} />
            )}
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function RecommendationContent({ payload }: { payload: FinalResponsePayload }) {
  const products = payload.recommendations.garments
    .map((garment) => garment.best_match)
    .filter(Boolean) as ProductRecommendation[];

  const featuredProduct =
    products[0] ??
    payload.recommendations.outfits
      .flatMap((outfit) => outfit.items.map((item) => item.best_match))
      .find(Boolean) ??
    null;

  const featuredImage = featuredProduct
    ? featuredProduct.images.default ||
      featuredProduct.images.front ||
      featuredProduct.images.search ||
      featuredProduct.images.top ||
      null
    : null;

  return (
    <>
      {featuredProduct ? (
        <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/75">
          {featuredImage ? (
            <Image
              alt={featuredProduct.product_display_name}
              className="aspect-[4/5] w-full object-cover"
              src={featuredImage}
              width={720}
              height={900}
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-[rgba(143,79,43,0.08)] text-sm text-[var(--muted)]">
              No image available
            </div>
          )}
          <div className="space-y-3 p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Featured product</p>
            <h3 className="serif text-3xl leading-none">{featuredProduct.product_display_name}</h3>
            <p className="text-sm leading-7 text-[var(--muted)]">
              {[featuredProduct.brand, featuredProduct.base_colour, featuredProduct.article_type]
                .filter(Boolean)
                .join(" - ") || "Curated selection"}
            </p>
            {featuredProduct.price !== null ? (
              <p className="text-sm font-semibold text-[var(--text)]">${featuredProduct.price.toFixed(2)}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {payload.recommendations.outfits.length > 0 ? (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Outfits</p>
            <h3 className="mt-2 serif text-2xl leading-none">Suggested combinations</h3>
          </div>
          {payload.recommendations.outfits.map((outfit, index) => (
            <article
              key={`${outfit.summary_label}-${index}`}
              className="rounded-[1.5rem] border border-[var(--line)] bg-white/72 p-5"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Look {index + 1}</p>
              <h4 className="mt-2 text-base font-semibold text-[var(--text)]">{outfit.summary_label}</h4>
              <div className="mt-4 space-y-3">
                {outfit.items.map((item, itemIndex) => (
                  <div
                    key={`${item.summary_label}-${itemIndex}`}
                    className="rounded-[1rem] bg-[rgba(143,79,43,0.06)] px-3 py-3"
                  >
                    <p className="text-sm font-medium text-[var(--text)]">{item.summary_label}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                      {item.best_match?.product_display_name || "No precise match"}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {payload.recommendations.garments.length > 0 ? (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Garments</p>
            <h3 className="mt-2 serif text-2xl leading-none">Individual pieces</h3>
          </div>
          <div className="space-y-3">
            {payload.recommendations.garments.map((garment, index) => (
              <article
                key={`${garment.summary_label}-${index}`}
                className="rounded-[1.4rem] border border-[var(--line)] bg-white/72 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{garment.summary_label}</p>
                    <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                      {garment.best_match?.product_display_name || "No match available"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[rgba(143,79,43,0.08)] px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {garment.total_candidates} candidates
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
