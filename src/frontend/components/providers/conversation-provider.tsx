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
      if (auth.status !== "authenticated" || !auth.token) {
        setConversations([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const items = await listConversations(auth.token);
        setConversations(items);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [auth.status, auth.token]);

  async function refreshConversations() {
    if (!auth.token) {
      return;
    }

    const items = await listConversations(auth.token);
    startTransition(() => {
      setConversations(items);
    });
  }

  async function createConversation(title?: string) {
    if (!auth.token) {
      throw new Error("Missing auth token");
    }

    const conversation = await createConversationRequest(auth.token, title);
    startTransition(() => {
      setConversations((current) => [conversation, ...current]);
    });
    return conversation;
  }

  async function deleteConversation(conversationId: string) {
    if (!auth.token) {
      throw new Error("Missing auth token");
    }

    await deleteConversationRequest(auth.token, conversationId);
    startTransition(() => {
      setConversations((current) => (
        current.filter((conversation) => conversation.id !== conversationId)
      ));
    });
  }

  async function updateConversation(conversationId: string, payload: ConversationUpdate) {
    if (!auth.token) {
      throw new Error("Missing auth token");
    }

    const updatedConversation = await updateConversationRequest(
      auth.token,
      conversationId,
      payload,
    );
    if (payload.is_pinned !== undefined) {
      const items = await listConversations(auth.token);
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
    if (!auth.token) {
      throw new Error("Missing auth token");
    }

    const items = await reorderConversationsRequest(auth.token, conversationIds);
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
