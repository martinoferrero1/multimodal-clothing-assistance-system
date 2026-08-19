"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  createConversation as createConversationRequest,
  deleteConversation as deleteConversationRequest,
  listConversations,
  reorderConversations as reorderConversationsRequest,
  updateConversation as updateConversationRequest,
} from "@/lib/api-client";
import type { Conversation, ConversationUpdate } from "@/lib/types";
import { useAuth } from "@/components/providers/auth-provider";

type ConversationContextValue = {
  conversations: Conversation[];
  loading: boolean;
  refreshConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  updateConversation: (conversationId: string, payload: ConversationUpdate) => Promise<Conversation>;
  reorderConversations: (conversationIds: string[]) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
};

const ConversationContext = createContext<ConversationContextValue | undefined>(undefined);

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (auth.status !== "authenticated") {
        setConversations([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const items = await listConversations();
        setConversations(items);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [auth.status]);

  async function refreshConversations() {
    if (auth.status !== "authenticated") {
      return;
    }

    const items = await listConversations();
    startTransition(() => {
      setConversations(items);
    });
  }

  async function createConversation(title?: string) {
    if (auth.status !== "authenticated") {
      throw new Error("Authentication required");
    }

    const conversation = await createConversationRequest(title);
    startTransition(() => {
      setConversations((current) => [conversation, ...current]);
    });
    return conversation;
  }

  async function deleteConversation(conversationId: string) {
    if (auth.status !== "authenticated") {
      throw new Error("Authentication required");
    }

    await deleteConversationRequest(conversationId);
    startTransition(() => {
      setConversations((current) => (
        current.filter((conversation) => conversation.id !== conversationId)
      ));
    });
  }

  async function updateConversation(conversationId: string, payload: ConversationUpdate) {
    if (auth.status !== "authenticated") {
      throw new Error("Authentication required");
    }

    const updatedConversation = await updateConversationRequest(conversationId, payload);
    if (payload.is_pinned !== undefined) {
      const items = await listConversations();
      startTransition(() => setConversations(items));
    } else {
      startTransition(() => {
        setConversations((current) => current.map((conversation) => (
          conversation.id === conversationId ? updatedConversation : conversation
        )));
      });
    }
    return updatedConversation;
  }

  async function reorderConversations(conversationIds: string[]) {
    if (auth.status !== "authenticated") {
      throw new Error("Authentication required");
    }

    const items = await reorderConversationsRequest(conversationIds);
    startTransition(() => setConversations(items));
  }

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        loading,
        refreshConversations,
        createConversation,
        updateConversation,
        reorderConversations,
        deleteConversation,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useConversations must be used within ConversationProvider");
  }

  return context;
}
