"use client";

import Image from "next/image";
import { startTransition, useEffect, useState } from "react";
import { ArrowUp, Check, LoaderCircle, Plus, Settings2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import {
  ApiError,
  getConversation,
  listMessages,
  sendMessage,
  updateConversationSearchPreferences,
} from "@/lib/api-client";
import { formatShortDate, formatShortTime } from "@/lib/format";
import {
  SEARCH_PRIORITY_OPTIONS,
  formatPriorityFields,
  togglePriorityField,
} from "@/lib/search-preferences";
import { readPreferences } from "@/lib/storage";
import type {
  ChatMessage,
  Conversation,
  FinalResponsePayload,
  SearchPriorityField,
} from "@/lib/types";
import { AssistantMessageBody } from "./assistant-message-body";
import { getProductImage, getProductMeta } from "@/lib/format";

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
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatPriorityDraft, setChatPriorityDraft] = useState<SearchPriorityField[] | null>(null);
  const [savingChatPreferences, setSavingChatPreferences] = useState(false);
  const [chatPreferencesError, setChatPreferencesError] = useState<string | null>(null);
  const [showRecommendationPanel, setShowRecommendationPanel] = useState(
    () => readPreferences().showRecommendationPanel,
  );
  const [isLargeScreen, setIsLargeScreen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  const [outfitModalOpen, setOutfitModalOpen] = useState(false);
  const [selectedOutfitState, setSelectedOutfitState] = useState<{
    messageId: string | null;
    outfitIndex: number;
  }>({
    messageId: null,
    outfitIndex: 0,
  });

  useEffect(() => {
    function syncPreferences() {
      const nextShowRecommendationPanel = readPreferences().showRecommendationPanel;
      setShowRecommendationPanel(nextShowRecommendationPanel);
      if (nextShowRecommendationPanel && window.matchMedia("(min-width: 1024px)").matches) {
        setOutfitModalOpen(false);
      }
    }

    window.addEventListener("preferences:changed", syncPreferences);
    return () => window.removeEventListener("preferences:changed", syncPreferences);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function syncScreenSize() {
      setIsLargeScreen(mediaQuery.matches);
      if (mediaQuery.matches && readPreferences().showRecommendationPanel) {
        setOutfitModalOpen(false);
      }
    }

    syncScreenSize();
    mediaQuery.addEventListener("change", syncScreenSize);
    return () => mediaQuery.removeEventListener("change", syncScreenSize);
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
    hasValidSelectedOutfit ? selectedRecommendationMessage : null;
  const activeRecommendationPayload = activeRecommendationMessage?.final_response_payload ?? null;
  const activeOutfitIndex =
    hasValidSelectedOutfit && activeRecommendationMessage?.id === selectedRecommendationMessage?.id
      ? selectedOutfitState.outfitIndex
      : 0;
  const usesRecommendationPanel = showRecommendationPanel && isLargeScreen;
  const userDefaultPriorityFields = auth.user?.search_preferences?.priority_fields ?? [];
  const conversationOverridePriorityFields =
    conversation?.search_preferences?.priority_fields ?? null;
  const effectiveSearchPriorityFields =
    conversationOverridePriorityFields ?? userDefaultPriorityFields;

  useEffect(() => {
    if (!outfitModalOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOutfitModalOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [outfitModalOpen]);

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
    if (!usesRecommendationPanel) {
      setOutfitModalOpen(true);
    }
  }

  function handleOpenChatSettings() {
    setChatPriorityDraft(conversation?.search_preferences?.priority_fields ?? null);
    setChatPreferencesError(null);
    setChatSettingsOpen(true);
  }

  async function handleSaveChatPreferences() {
    if (!auth.token || savingChatPreferences) {
      return;
    }

    setSavingChatPreferences(true);
    setChatPreferencesError(null);

    try {
      let activeConversation = conversation;
      if (!activeConversation) {
        activeConversation = await createConversation("New conversation");
        setConversation(activeConversation);
      }

      const updatedConversation = await updateConversationSearchPreferences(
        auth.token,
        activeConversation.id,
        chatPriorityDraft,
      );
      setConversation(updatedConversation);
      await refreshConversations();
      setChatSettingsOpen(false);

      if (conversationId === "new") {
        startTransition(() => {
          router.replace(`/chat/${updatedConversation.id}`);
        });
      }
    } catch (caughtError) {
      setChatPreferencesError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not save this chat's search priorities.",
      );
    } finally {
      setSavingChatPreferences(false);
    }
  }

  return (
    <section
      className={`grid min-h-[calc(100vh-2rem)] gap-4 pb-4 lg:h-full lg:min-h-0 lg:pt-4 ${
        usesRecommendationPanel
          ? "lg:grid-cols-[minmax(0,1fr)_21rem] lg:overflow-hidden"
          : "grid-cols-1"
      }`}
    >
      <div className="workspace-panel hairline flex min-h-[75vh] flex-col rounded-[2rem] lg:h-full lg:min-h-0 lg:rounded-tr-[0.6rem]">
        <div
          className={`thread-fade scroll-muted min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 ${
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
                      className={
                        isUser
                          ? "max-w-3xl rounded-[1.6rem] bg-[var(--text)] px-5 py-4 text-[var(--accent-ink)]"
                          : "max-w-5xl text-[var(--text)]"
                      }
                    >
                      {isUser ? (
                        <div className="mb-3 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.26em] opacity-70">
                          <span> You </span>
                          <span>{formatShortTime(message.created_at)}</span>
                        </div>
                      ) : null}

                      {isUser ? (
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </p>
                      ) : (
                        <AssistantMessageBody
                          message={message}
                          activeRecommendationMessageId={
                            activeRecommendationMessage?.id ?? null
                          }
                          activeOutfitIndex={activeOutfitIndex}
                          onSelectOutfit={handleSelectOutfit}
                          recommendationSurface={
                            usesRecommendationPanel ? "panel" : "modal"
                          }
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
              <button
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)]"
                type="button"
                onClick={handleOpenChatSettings}
                aria-label="Chat search preferences"
              >
                <Settings2 size={18} />
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

      {usesRecommendationPanel ? (
        <aside className="glass-strong hairline hidden min-h-[75vh] flex-col rounded-[2rem] lg:flex lg:h-full lg:min-h-0 lg:overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
              Recommendation panel
            </p>
          </div>

          <div className="flex-1 space-y-6 overflow-hidden p-6">
            {!activeRecommendationPayload ||
            activeRecommendationPayload.recommendations.outfits.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-[var(--line-strong)] bg-white/60 p-5 text-sm leading-7 text-[var(--muted)]">
                Select an outfit from the conversation to inspect it here.
              </div>
            ) : (
              <RecommendationContent
                payload={activeRecommendationPayload}
                selectedOutfitIndex={activeOutfitIndex}
              />
            )}
          </div>
        </aside>
      ) : null}

      {outfitModalOpen && activeRecommendationPayload ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(32,20,12,0.42)] p-4 sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Close outfit viewer"
            onClick={() => setOutfitModalOpen(false)}
          />
          <div className="glass-strong hairline soft-shadow relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[2rem] px-5 py-5 sm:px-6">
            <div className="mb-4 flex items-center justify-end gap-4">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/60 transition hover:bg-white/85"
                type="button"
                aria-label="Close outfit viewer"
                onClick={() => setOutfitModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <RecommendationContent
              payload={activeRecommendationPayload}
              selectedOutfitIndex={activeOutfitIndex}
            />
          </div>
        </div>
      ) : null}

      {chatSettingsOpen ? (
        <ChatSearchPreferencesModal
          draftPriorityFields={chatPriorityDraft}
          effectivePriorityFields={effectiveSearchPriorityFields}
          error={chatPreferencesError}
          saving={savingChatPreferences}
          onClose={() => setChatSettingsOpen(false)}
          onDraftChange={setChatPriorityDraft}
          onSave={handleSaveChatPreferences}
        />
      ) : null}
    </section>
  );
}

type ChatSearchPreferencesModalProps = {
  draftPriorityFields: SearchPriorityField[] | null;
  effectivePriorityFields: SearchPriorityField[];
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onDraftChange: (fields: SearchPriorityField[] | null) => void;
  onSave: () => void;
};

function ChatSearchPreferencesModal({
  draftPriorityFields,
  effectivePriorityFields,
  error,
  saving,
  onClose,
  onDraftChange,
  onSave,
}: ChatSearchPreferencesModalProps) {
  const usesCustomPriorities = draftPriorityFields !== null;
  const visiblePriorityFields = draftPriorityFields ?? effectivePriorityFields;

  function handleToggleField(field: SearchPriorityField) {
    const baseFields = draftPriorityFields ?? effectivePriorityFields;
    onDraftChange(togglePriorityField(baseFields, field));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(32,20,12,0.42)] p-4 sm:p-6">
      <button
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Close chat search preferences"
        onClick={onClose}
      />
      <div className="glass-strong hairline soft-shadow relative z-10 w-full max-w-2xl rounded-[2rem] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Search preferences
            </p>
            <h3 className="serif mt-3 text-3xl leading-none">This chat</h3>
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/60 transition hover:bg-white/85"
            type="button"
            aria-label="Close chat search preferences"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-[1.1rem] border border-[var(--line)] bg-white/52 p-1">
          <button
            className={`rounded-[0.9rem] px-3 py-3 text-sm font-semibold transition ${
              !usesCustomPriorities
                ? "bg-[var(--text)] text-[var(--accent-ink)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            type="button"
            onClick={() => onDraftChange(null)}
          >
            Inherit general
          </button>
          <button
            className={`rounded-[0.9rem] px-3 py-3 text-sm font-semibold transition ${
              usesCustomPriorities
                ? "bg-[var(--text)] text-[var(--accent-ink)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            type="button"
            onClick={() => onDraftChange([...effectivePriorityFields])}
          >
            Customize
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          {usesCustomPriorities ? "Custom: " : "Inherited: "}
          {formatPriorityFields(visiblePriorityFields)}
        </p>

        {usesCustomPriorities ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SEARCH_PRIORITY_OPTIONS.map((option) => {
              const checked = visiblePriorityFields.includes(option.field);

              return (
                <button
                  key={option.field}
                  className={`flex min-h-[5rem] items-start gap-3 rounded-[1.1rem] border px-3 py-3 text-left transition ${
                    checked
                      ? "border-[rgba(143,79,43,0.34)] bg-[rgba(143,79,43,0.09)]"
                      : "border-[var(--line)] bg-white/62 hover:bg-white/86"
                  }`}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => handleToggleField(option.field)}
                >
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.55rem] border ${
                      checked
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                        : "border-[var(--line-strong)] bg-white/70 text-transparent"
                    }`}
                  >
                    <Check size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-[1rem] bg-[rgba(255,234,229,0.8)] px-3 py-2 text-sm text-[#8c2616]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 text-sm font-semibold text-[var(--muted)] transition hover:bg-white/65 hover:text-[var(--text)]"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecommendationContent({
  payload,
  selectedOutfitIndex,
}: {
  payload: FinalResponsePayload;
  selectedOutfitIndex: number;
}) {
  const outfits = payload.recommendations.outfits;
  const selectedOutfit = outfits[selectedOutfitIndex] ?? outfits[0];

  if (!selectedOutfit) {
    return null;
  }

  return (
    <article className="space-y-4 rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5">
      <div>
        <h4 className="mt-2 serif text-3xl leading-none capitalize">
          {selectedOutfit.summary_label}
        </h4>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)] capitalize">
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
  );
}
