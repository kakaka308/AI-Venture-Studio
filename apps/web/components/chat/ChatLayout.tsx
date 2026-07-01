"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ConversationList, { type Conversation } from "./ConversationList";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { useObservability } from "@/lib/observability/useObservability";

/** Agent 中文名称映射 */
const AGENT_LABELS: Record<string, string> = {
  market: "市场分析",
  pm: "产品需求",
  architect: "技术架构",
  database: "数据库设计",
  planning: "开发计划",
  risk: "风险评估",
  reviewer: "质量审查",
  summarize: "报告汇总",
};

export default function ChatLayout() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [input, setInput] = useState("");
  const conversationIdRef = useRef<string | null>(null);
  const projectId = useMemo(() => searchParams.get("projectId"), [searchParams]);
  const [projectName, setProjectName] = useState<string>("");

  // Keep ref in sync with state so callbacks can read the latest value
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Load project name from API
  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectName("");
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.name) setProjectName(data.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

  // Memoize transport to prevent re-creation on every render
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    []
  );

  const {
    messages,
    status,
    sendMessage,
    setMessages,
    error,
  } = useChat({
    transport,
    onToolCall: ({ toolCall }) => {
      const tc = toolCall as unknown as {
        toolName: string;
        args: Record<string, unknown>;
        state: string;
        result?: unknown;
      };
      console.log(
        `%c[Tool Call] %c${tc.toolName}`,
        "color: #8b5cf6; font-weight: bold;",
        "color: #6366f1;",
        "\n  参数:",
        tc.args,
        tc.state === "result"
          ? `\n  结果: ${(() => { try { return JSON.stringify(tc.result).slice(0, 200); } catch { return "[序列化失败]"; } })()}`
          : "",
      );
    },
    onFinish: (msg) => {
      console.log("[Chat] onFinish called, message:", JSON.stringify(msg).slice(0, 100));
      refreshConversations();
    },
    onError: (err) => {
      console.error("[Chat] useChat error:", err);
    },
  });


  const isLoading = status === "submitted" || status === "streaming";

  // --- Multi-Agent 工作流状态 ---
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<
    Record<string, { status: string; duration?: number; tokens?: number }>
  >({});
  const workflowAbortRef = useRef<AbortController | null>(null);

  /**
   * 启动 Multi-Agent 工作流
   * 调用 /api/workflow 并通过 SSE 接收每个 Agent 节点的实时状态
   */
  const runWorkflow = useCallback(async () => {
    if (workflowRunning || !projectId) return;

    const abort = new AbortController();
    workflowAbortRef.current = abort;

    // 初始化所有节点为 pending
    const init: Record<string, { status: string }> = {};
    Object.keys(AGENT_LABELS).forEach((key) => {
      init[key] = { status: "pending" };
    });
    setWorkflowProgress(init);
    setWorkflowRunning(true);

    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: `请对项目 "${projectName || projectId?.slice(0, 8)}" 进行完整的 Multi-Agent 分析`,
          projectId,
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        throw new Error(`Workflow API 返回 ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr);
            const eventName: string = event.event || event.name || "";
            const nodeName: string = event.name || event.metadata?.langgraph_node || "";

            if (!nodeName) continue;

            // Agent 开始
            if (eventName.includes("start") || eventName === "on_chain_start") {
              setWorkflowProgress((prev) => ({
                ...prev,
                [nodeName]: { status: "running" },
              }));
            }

            // Agent 完成
            if (eventName.includes("end") || eventName === "on_chain_end") {
              setWorkflowProgress((prev) => ({
                ...prev,
                [nodeName]: {
                  status: "success",
                  duration: event.data?.duration,
                  tokens: event.data?.tokens,
                },
              }));
            }
          } catch {
            // 跳过解析失败的行
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[ChatLayout] 工作流执行失败:", err);

      setWorkflowProgress((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].status === "running") {
            next[key] = { status: "error" };
          }
        }
        return next;
      });
    } finally {
      setWorkflowRunning(false);
      workflowAbortRef.current = null;
      refreshConversations();
    }
  }, [workflowRunning, projectId, projectName, refreshConversations]);

  // 组件卸载时取消工作流
  useEffect(() => {
    return () => {
      workflowAbortRef.current?.abort();
    };
  }, []);

  // 可观测性 WebSocket 连接
  const {
    currentTrace,
    events: observabilityEvents,
    connected: observabilityConnected,
  } = useObservability({
    conversationId,
    projectId,
    enabled: isLoading,
  });

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

      sendMessage({ text: input }, { body: { conversationId, projectId } });
      setInput("");
    },
    [conversationId, projectId, input, isLoading, sendMessage]
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
          {projectId && (
            <Link
              href={`/projects/${projectId}`}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              返回项目
            </Link>
          )}
          <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
            {projectId && projectName ? (
              <span>
                <span className="text-blue-600">📁 {projectName}</span>
                <span className="mx-2 text-gray-300">|</span>
              </span>
            ) : projectId ? (
              <span>
                <span className="text-blue-600">📁 项目 #{projectId.slice(0, 8)}</span>
                <span className="mx-2 text-gray-300">|</span>
              </span>
            ) : null}
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
            <MessageList
              messages={messages}
              isLoading={isLoading}
              observabilityTrace={currentTrace}
              observabilityEvents={observabilityEvents}
              observabilityConnected={observabilityConnected}
              workflowRunning={workflowRunning}
              workflowProgress={workflowProgress}
            />
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
          showWorkflowButton={!!projectId}
          workflowRunning={workflowRunning}
          onRunWorkflow={runWorkflow}
        />
      </main>
    </div>
  );
}
