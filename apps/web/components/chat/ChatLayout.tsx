"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useRef } from "react";
import type { UIMessage } from "ai";
import ConversationList, { type Conversation } from "./ConversationList";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

export default function ChatLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [input, setInput] = useState("");
  const conversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with state so callbacks can read the latest value
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // --- Refresh conversations from API ---
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  const {
    messages,
    status,
    sendMessage,
    setMessages,
    error,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
    }),
    onFinish: () => {
      refreshConversations();
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // --- Initialize: auto-select or auto-create a conversation ---
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) return;
        const data: Conversation[] = await res.json();
        setConversations(data);

        if (data.length > 0) {
          // Auto-select the most recent conversation
          setConversationId(data[0].id);
          const msgRes = await fetch(`/api/conversations/${data[0].id}`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            setMessages(msgData.messages || []);
          }
        } else {
          // No conversations yet — create one so the user can start typing
          const createRes = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "New Chat" }),
          });
          if (createRes.ok) {
            const newConv = await createRes.json();
            setConversations([newConv]);
            setConversationId(newConv.id);
            setMessages([]);
          }
        }
      } catch (err) {
        console.error("Failed to initialize conversations:", err);
      } finally {
        setConversationsLoading(false);
      }
    };
    init();
    // Run once on mount — setMessages is stable from useChat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Select a conversation ---
  const selectConversation = useCallback(
    async (id: string) => {
      setConversationId(id);
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    },
    [setMessages]
  );

  // --- Create new conversation ---
  const newConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => [data, ...prev]);
        setConversationId(data.id);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, [setMessages]);

  // --- Delete a conversation ---
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          if (conversationIdRef.current === id) {
            setConversationId(null);
            setMessages([]);
          }
          setConversations((prev) => prev.filter((c) => c.id !== id));
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [setMessages]
  );

  // --- Form submit handler ---
  const onFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!conversationId) {
        console.error("Cannot submit: no conversation selected");
        return;
      }
      if (!input.trim() || isLoading) return;

      sendMessage({ text: input });
      setInput("");
    },
    [conversationId, input, isLoading, sendMessage]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 overflow-hidden border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          currentId={conversationId}
          loading={conversationsLoading}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={deleteConversation}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Header bar */}
        <header className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-4 h-14 shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open sidebar"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
            {conversationId
              ? conversations.find((c) => c.id === conversationId)?.title ||
                  "Chat"
              : "AI Venture Chat"}
          </h1>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 px-4">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4 opacity-50"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-lg font-medium mb-1">Start a conversation</p>
              <p className="text-sm">
                Select a conversation from the sidebar or create a new one
              </p>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={isLoading} />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-t border-red-200 dark:border-red-900">
            Error: {error.message || "Something went wrong"}
          </div>
        )}

        {/* Input */}
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={onFormSubmit}
          isLoading={isLoading}
          disabled={false}
        />
      </main>
    </div>
  );
}
