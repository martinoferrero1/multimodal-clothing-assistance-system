"use client";

import Image from "next/image";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ImagePlus,
  LoaderCircle,
  MessageCirclePlus,
  Plus,
  Settings2,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import {
  ApiError,
  getConversation,
  listMessages,
  sendMessage,
  updateConversationSearchPreferences,
  updateConversationStylePreferences,
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
  StylePreferenceDetails,
} from "@/lib/types";
import { AssistantMessageBody } from "./assistant-message-body";
import { getProductImage, getProductMeta } from "@/lib/format";

type ChatWorkspaceProps = {
  conversationId: string;
};

type PendingImage = {
  id: string;
  file: File;
  dataUrl: string;
};

type ChatStyleDraft = {
  use_personalized_styles: boolean | null;
  temporary_notes: string;
};

const MAX_PENDING_IMAGES = 3;
const MAX_PENDING_IMAGE_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function temporaryStyleDetailsFromNote(note: string): StylePreferenceDetails {
  const cleanNote = note.trim() || null;
  return {
    liked_styles: [],
    disliked_styles: [],
    preferred_colors: [],
    avoided_colors: [],
    preferred_brands: [],
    avoided_brands: [],
    preferred_fits: [],
    occasions: [],
    budget_notes: null,
    sizing_notes: null,
    freeform_notes: cleanNote,
  };
}

export function ChatWorkspace({ conversationId }: ChatWorkspaceProps) {
  const auth = useAuth();
  const router = useRouter();
  const { createConversation, refreshConversations } = useConversations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedImages, setSelectedImages] = useState<PendingImage[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatPriorityDraft, setChatPriorityDraft] = useState<SearchPriorityField[] | null>(null);
  const [chatStyleDraft, setChatStyleDraft] = useState<ChatStyleDraft>({
    use_personalized_styles: null,
    temporary_notes: "",
  });
  const [savingChatPreferences, setSavingChatPreferences] = useState(false);
  const [chatPreferencesError, setChatPreferencesError] = useState<string | null>(null);
  const [showRecommendationPanel, setShowRecommendationPanel] = useState(
    () => readPreferences().showRecommendationPanel,
  );
  const [recommendationPanelHidden, setRecommendationPanelHidden] = useState(false);
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
      if (nextShowRecommendationPanel) {
        setRecommendationPanelHidden(false);
      } else {
        setRecommendationPanelHidden(false);
        setOutfitModalOpen(false);
        setSelectedOutfitState({ messageId: null, outfitIndex: 0 });
      }
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
  const activeOutfitTitle =
    activeRecommendationPayload?.recommendations.outfits[activeOutfitIndex]?.summary_label ??
    "Outfit details";
  const canUseRecommendationPanel = showRecommendationPanel && isLargeScreen;
  const usesRecommendationPanel = canUseRecommendationPanel && !recommendationPanelHidden;
  const shouldMarkSelectedOutfit = usesRecommendationPanel || outfitModalOpen;
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
        setSelectedOutfitState({ messageId: null, outfitIndex: 0 });
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
    const imagesToSend = selectedImages;
    if ((!trimmed && imagesToSend.length === 0) || !auth.token || sending) {
      return;
    }

    setSending(true);
    setError(null);
    setDraft("");
    setSelectedImages([]);

    const displayContent =
      trimmed ||
      (imagesToSend.length === 1
        ? `Search products based on ${imagesToSend[0].file.name}.`
        : "Search products based on the uploaded images.");

    const optimisticUserMessage: ChatMessage = {
      id: `pending-user-${Date.now()}`,
      conversation_id: conversation?.id ?? "new",
      role: "user",
      content: displayContent,
      attachments:
        imagesToSend.length > 0
          ? imagesToSend.map((image) => ({
              id: image.id,
              filename: image.file.name,
              content_type: image.file.type,
              data_url: image.dataUrl,
              description: null,
              analysis: null,
            }))
          : null,
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
      attachments: null,
      final_response_payload: null,
      workflow_errors: null,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((current) => [...current, optimisticUserMessage, optimisticAssistantMessage]);

    try {
      let activeConversation = conversation;
      if (conversationId === "new" || !activeConversation) {
        activeConversation = await createConversation(displayContent.slice(0, 60));
        setConversation(activeConversation);
      }

      const response = await sendMessage(
        auth.token,
        activeConversation.id,
        trimmed,
        imagesToSend.map((image) => image.file),
      );

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
      setSelectedImages(imagesToSend);
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not send your message to the assistant.",
      );
    } finally {
      setSending(false);
    }
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleOpenImagePicker() {
    setAttachmentMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function handleImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) {
      return;
    }

    setError(null);
    const remainingSlots = MAX_PENDING_IMAGES - selectedImages.length;
    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_PENDING_IMAGES} images per message.`);
      return;
    }

    const acceptedFiles = files.slice(0, remainingSlots);
    const pendingImages: PendingImage[] = [];
    for (const file of acceptedFiles) {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
        setError("Only JPEG, PNG, WEBP, or GIF images are supported.");
        continue;
      }

      if (file.size > MAX_PENDING_IMAGE_BYTES) {
        setError("Each image must be 4 MB or smaller.");
        continue;
      }

      pendingImages.push({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        dataUrl: await readFileAsDataUrl(file),
      });
    }

    if (files.length > remainingSlots) {
      setError(`Only the first ${remainingSlots} image(s) were attached.`);
    }

    if (pendingImages.length > 0) {
      setSelectedImages((current) => [...current, ...pendingImages]);
    }
  }

  function handleRemoveSelectedImage(imageId: string) {
    setSelectedImages((current) => current.filter((image) => image.id !== imageId));
  }

  function handleSelectOutfit(messageId: string, outfitIndex: number) {
    setSelectedOutfitState({ messageId, outfitIndex });
    if (canUseRecommendationPanel) {
      setRecommendationPanelHidden(false);
      return;
    }

    if (!usesRecommendationPanel) {
      setOutfitModalOpen(true);
    }
  }

  function handleClearOutfitSelection() {
    setSelectedOutfitState({ messageId: null, outfitIndex: 0 });
  }

  function handleCloseOutfitModal() {
    setOutfitModalOpen(false);
    handleClearOutfitSelection();
  }

  function handleHideRecommendationPanel() {
    setRecommendationPanelHidden(true);
    handleClearOutfitSelection();
  }

  function handleOpenChatSettings() {
    setChatPriorityDraft(conversation?.search_preferences?.priority_fields ?? null);
    setChatStyleDraft({
      use_personalized_styles: conversation?.style_preferences?.use_personalized_styles ?? null,
      temporary_notes: conversation?.style_preferences?.temporary.freeform_notes ?? "",
    });
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

      let updatedConversation = await updateConversationSearchPreferences(
        auth.token,
        activeConversation.id,
        chatPriorityDraft,
      );
      updatedConversation = await updateConversationStylePreferences(
        auth.token,
        activeConversation.id,
        {
          use_personalized_styles: chatStyleDraft.use_personalized_styles,
          temporary: temporaryStyleDetailsFromNote(chatStyleDraft.temporary_notes),
        },
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
      className={`relative grid min-h-[calc(100vh-2rem)] gap-4 transition-[grid-template-columns,gap] duration-300 ease-out lg:h-full lg:min-h-0 lg:pt-4 ${
        canUseRecommendationPanel
          ? recommendationPanelHidden
            ? "lg:grid-cols-[minmax(0,1fr)_0rem] lg:gap-0 lg:overflow-hidden"
            : "lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-4 lg:overflow-hidden"
          : "grid-cols-1"
      }`}
    >
      <div className="flex min-h-[75vh] flex-col lg:h-full lg:min-h-0">
        <div
          className={`thread-fade scroll-muted min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 ${
            !loading && !error && messages.length === 0
              ? "flex items-center justify-center"
              : ""
          }`}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm text-[var(--muted)]">
                <LoaderCircle size={16} className="animate-spin" />
                Loading conversation...
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mx-auto w-full max-w-4xl rounded-[1.4rem] border border-[var(--danger-line)] bg-[var(--danger-surface)] px-5 py-4 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          {!loading && !error && messages.length === 0 ? (
            <div className="mx-auto w-full max-w-4xl animate-rise-in rounded-lg border border-dashed border-[var(--line-strong)] bg-[rgba(208,188,255,0.06)] p-8 text-center">
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
            <div className="mx-auto w-full max-w-4xl space-y-8">
              <div className="flex justify-center">
                <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                  {formatShortDate(messages[messages.length - 1].created_at)}
                </span>
              </div>

              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`animate-rise-in flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[78%] rounded-[1.6rem] bg-[var(--surface-highest)] px-5 py-4 text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                          : "w-full text-[var(--text)]"
                      }
                    >
                      {isUser ? (
                        <div className="mb-3 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.26em] opacity-70">
                          <span> You </span>
                          <span>{formatShortTime(message.created_at)}</span>
                        </div>
                      ) : null}

                      {isUser ? (
                        message.attachments?.length ? (
                          <div className="mb-3 grid max-w-md grid-cols-2 gap-2">
                            {message.attachments.map((attachment) => (
                              <Image
                                key={attachment.id}
                                alt={attachment.filename}
                                className="aspect-square rounded-[1rem] object-cover"
                                src={attachment.data_url}
                                width={220}
                                height={220}
                                unoptimized
                              />
                            ))}
                          </div>
                        ) : null
                      ) : null}

                      {isUser ? (
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </p>
                      ) : (
                        <AssistantMessageBody
                          message={message}
                          activeRecommendationMessageId={
                            shouldMarkSelectedOutfit
                              ? activeRecommendationMessage?.id ?? null
                              : null
                          }
                          activeOutfitIndex={activeOutfitIndex}
                          onSelectOutfit={handleSelectOutfit}
                          recommendationSurface={
                            canUseRecommendationPanel ? "panel" : "modal"
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
          className="px-5 pb-5 pt-3 sm:px-8"
          onSubmit={handleSend}
        >
          <div className="mx-auto w-full max-w-4xl rounded-[1.4rem] border border-[var(--line)] bg-[rgba(32,31,31,0.78)] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            {selectedImages.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2 px-1">
                {selectedImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative h-20 w-20 overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--surface-high)]"
                  >
                    <Image
                      alt={image.file.name}
                      className="h-full w-full object-cover"
                      src={image.dataUrl}
                      width={160}
                      height={160}
                      unoptimized
                    />
                    <button
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black/90"
                      type="button"
                      aria-label={`Remove ${image.file.name}`}
                      onClick={() => handleRemoveSelectedImage(image.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-3">
              <div className="relative">
                <button
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)]"
                  type="button"
                  onClick={() => setAttachmentMenuOpen((open) => !open)}
                  aria-label="Open attachment actions"
                  aria-expanded={attachmentMenuOpen}
                >
                  <Plus size={18} />
                </button>

                {attachmentMenuOpen ? (
                  <div className="absolute bottom-14 left-0 z-30 w-56 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-high)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur">
                    <button
                      className="flex w-full items-center gap-3 rounded-[0.5rem] px-3 py-3 text-left text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
                      type="button"
                      onClick={handleOpenImagePicker}
                    >
                      <ImagePlus size={17} />
                      Upload image
                    </button>
                    <button
                      className="flex w-full items-center gap-3 rounded-[0.5rem] px-3 py-3 text-left text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
                      type="button"
                      onClick={() => {
                        setAttachmentMenuOpen(false);
                        router.push("/chat/new");
                      }}
                    >
                      <MessageCirclePlus size={17} />
                      New conversation
                    </button>
                  </div>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleImageSelection}
              />
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
                onKeyDown={handleDraftKeyDown}
              />

              <button
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={sending || (!draft.trim() && selectedImages.length === 0)}
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

      {canUseRecommendationPanel && recommendationPanelHidden ? (
        <button
          className="surface-recommendation absolute right-0 top-4 hidden items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] shadow-[0_14px_32px_rgba(0,0,0,0.12)] transition hover:text-[var(--text)] lg:inline-flex"
          type="button"
          onClick={() => setRecommendationPanelHidden(false)}
        >
          <Shirt size={15} />
          View outfits
        </button>
      ) : null}

      {canUseRecommendationPanel ? (
        <aside
          className={`surface-recommendation hairline hidden min-h-[75vh] w-full min-w-0 flex-col rounded-xl transition-[opacity,transform,filter] duration-300 ease-out lg:flex lg:h-full lg:min-h-0 lg:overflow-hidden ${
            recommendationPanelHidden
              ? "pointer-events-none translate-x-3 opacity-0 blur-[1px]"
              : "translate-x-0 opacity-100 blur-0"
          }`}
          aria-hidden={recommendationPanelHidden}
        >
          <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
            <h3 className="min-w-0 truncate text-base font-semibold capitalize text-[var(--text)]">
              {activeRecommendationPayload ? activeOutfitTitle : "Recommendations"}
            </h3>
            <button
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              aria-label="Hide recommendation panel"
              onClick={handleHideRecommendationPanel}
            >
              <X size={16} />
            </button>
          </div>

          <div className="scroll-modal min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {!activeRecommendationPayload ||
            activeRecommendationPayload.recommendations.outfits.length === 0 ? (
              <div className="border-y border-dashed border-[var(--line-strong)] py-5 text-sm leading-7 text-[var(--muted)]">
                Select an outfit from the conversation to inspect it here.
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  <button
                    className="rounded-lg bg-[var(--text)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:opacity-90"
                    type="button"
                    onClick={handleClearOutfitSelection}
                  >
                    Clear
                  </button>
                </div>
                <RecommendationContent
                  payload={activeRecommendationPayload}
                  selectedOutfitIndex={activeOutfitIndex}
                />
              </>
            )}
          </div>
        </aside>
      ) : null}

      {outfitModalOpen && activeRecommendationPayload ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            tabIndex={-1}
            aria-label="Close outfit viewer"
            onClick={handleCloseOutfitModal}
          />
          <div
            className="modal-shell relative z-10 flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl sm:h-[min(44rem,calc(100dvh-3rem))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="outfit-dialog-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
              <h3 id="outfit-dialog-title" className="text-base font-semibold capitalize text-[var(--text)]">{activeOutfitTitle}</h3>
              <button
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)] transition hover:text-[var(--text)]"
                type="button"
                autoFocus
                aria-label="Close outfit viewer"
                onClick={handleCloseOutfitModal}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scroll-modal min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <RecommendationContent
                payload={activeRecommendationPayload}
                selectedOutfitIndex={activeOutfitIndex}
              />
            </div>
          </div>
        </div>
      ) : null}

      {chatSettingsOpen ? (
        <ChatSearchPreferencesModal
          draftPriorityFields={chatPriorityDraft}
          effectivePriorityFields={effectiveSearchPriorityFields}
          styleDraft={chatStyleDraft}
          error={chatPreferencesError}
          saving={savingChatPreferences}
          onClose={() => setChatSettingsOpen(false)}
          onDraftChange={setChatPriorityDraft}
          onStyleDraftChange={setChatStyleDraft}
          onSave={handleSaveChatPreferences}
        />
      ) : null}
    </section>
  );
}

type ChatSearchPreferencesModalProps = {
  draftPriorityFields: SearchPriorityField[] | null;
  effectivePriorityFields: SearchPriorityField[];
  styleDraft: ChatStyleDraft;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onDraftChange: (fields: SearchPriorityField[] | null) => void;
  onStyleDraftChange: (draft: ChatStyleDraft) => void;
  onSave: () => void;
};

function ChatSearchPreferencesModal({
  draftPriorityFields,
  effectivePriorityFields,
  styleDraft,
  error,
  saving,
  onClose,
  onDraftChange,
  onStyleDraftChange,
  onSave,
}: ChatSearchPreferencesModalProps) {
  const usesCustomPriorities = draftPriorityFields !== null;
  const visiblePriorityFields = draftPriorityFields ?? effectivePriorityFields;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleToggleField(field: SearchPriorityField) {
    const baseFields = draftPriorityFields ?? effectivePriorityFields;
    onDraftChange(togglePriorityField(baseFields, field));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6">
      <button
        className="absolute inset-0 cursor-default"
        type="button"
        tabIndex={-1}
        aria-label="Close chat search preferences"
        onClick={onClose}
      />
      <div
        className="modal-shell relative z-10 flex h-[min(42rem,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl sm:h-[min(42rem,calc(100dvh-3rem))]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-preferences-dialog-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div>
            <h3 id="chat-preferences-dialog-title" className="serif text-2xl leading-none sm:text-3xl">Configure Preferences</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Search and style settings for this conversation.
            </p>
          </div>
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)] transition hover:text-[var(--text)]"
            type="button"
            autoFocus
            aria-label="Close chat search preferences"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <div className="modal-body scroll-modal min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Search behavior
            </p>
            <div className="mt-3 grid grid-cols-2 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] p-1">
              <button
                className={`option-row px-3 py-3 text-sm font-semibold ${
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
                className={`option-row px-3 py-3 text-sm font-semibold ${
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
              <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
                {SEARCH_PRIORITY_OPTIONS.map((option) => {
                  const checked = visiblePriorityFields.includes(option.field);

                  return (
                    <button
                      key={option.field}
                      className={`option-row flex min-h-[5rem] items-start gap-3 border-b px-2 py-3 text-left ${
                        checked
                          ? "border-[rgba(208,188,255,0.42)] bg-[var(--accent-soft)]"
                          : "border-[var(--line)] hover:bg-[var(--surface)]"
                      }`}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => handleToggleField(option.field)}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          checked
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                            : "border-[var(--line-strong)] bg-[var(--surface-high)] text-transparent"
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
          </section>

          <section className="mt-7 border-t border-[var(--line)] pt-6">
            <p className="text-sm font-semibold text-[var(--text)]">Personalized styles</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Choose whether this chat should use your saved style memory and add temporary style guidance for this conversation only.
            </p>
            <div className="mt-4 grid grid-cols-3 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] p-1">
              {[
                { label: "Inherit", value: null },
                { label: "Use", value: true },
                { label: "Ignore", value: false },
              ].map((option) => (
                <button
                  key={option.label}
                  className={`option-row px-3 py-3 text-sm font-semibold ${
                    styleDraft.use_personalized_styles === option.value
                      ? "bg-[var(--text)] text-[var(--accent-ink)]"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                  type="button"
                  onClick={() =>
                    onStyleDraftChange({
                      ...styleDraft,
                      use_personalized_styles: option.value,
                    })
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Temporary style notes
              </span>
              <textarea
                className="mt-2 min-h-[5rem] w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
                placeholder="Example: make this conversation more formal, avoid sneakers"
                value={styleDraft.temporary_notes}
                onChange={(event) =>
                  onStyleDraftChange({
                    ...styleDraft,
                    temporary_notes: event.target.value,
                  })
                }
              />
            </label>
          </section>

          {error ? (
            <p className="mt-4 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-surface)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--line)] px-5 py-4 sm:px-6">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)]"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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
    <article>
      <div className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
        {selectedOutfit.items.map((item, itemIndex) => {
          const image = getProductImage(item.best_match);

          return (
            <article
              key={`${selectedOutfit.summary_label}-${itemIndex}`}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4"
            >
              {image ? (
                <Image
                  alt={
                    item.best_match?.product_display_name || item.summary_label
                  }
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                  src={image}
                  width={280}
                  height={350}
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-[var(--surface-high)] text-center text-[11px] text-[var(--muted)]">
                  No image
                </div>
              )}

              <div className="min-w-0">
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                  {item.best_match?.product_display_name ||
                    "No precise match yet"}
                </p>
                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                  {getProductMeta(item.best_match)}
                </p>
                {item.best_match?.price !== null &&
                item.best_match?.price !== undefined ? (
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
