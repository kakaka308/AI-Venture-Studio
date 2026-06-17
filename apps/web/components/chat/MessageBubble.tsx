"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import type { Components } from "react-markdown";

interface MessageBubbleProps {
  message: UIMessage | { id?: string; role: string; content: string };
}

// 中文工具名映射
const TOOL_NAMES_CN: Record<string, string> = {
  getProjectContext: "获取项目上下文",
  saveProjectMemory: "保存项目记忆",
  createTask: "创建任务",
  searchKnowledgeBase: "搜索知识库",
};

// 工具图标映射
const TOOL_ICONS: Record<string, string> = {
  getProjectContext: "📋",
  saveProjectMemory: "🧠",
  createTask: "✅",
  searchKnowledgeBase: "🔍",
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Extract text content and tool-call parts
  const { textContent, toolParts } = useMemo(() => {
    if ("parts" in message && Array.isArray(message.parts)) {
      const textParts: string[] = [];
      const toolPartsList: Array<{
        toolName: string;
        args: Record<string, unknown>;
        result?: unknown;
        state: string;
      }> = [];

      for (const part of message.parts) {
        if (part.type === "text") {
          textParts.push((part as { text: string }).text);
        } else if (part.type?.startsWith("tool-")) {
          const tp = part as unknown as {
            toolName: string;
            args?: Record<string, unknown>;
            result?: unknown;
            state?: string;
          };
          toolPartsList.push({
            toolName: tp.toolName,
            args: tp.args ?? {},
            result: tp.result,
            state: tp.state ?? "call",
          });
        }
      }

      return {
        textContent: textParts.join(""),
        toolParts: toolPartsList,
      };
    }
    return {
      textContent: (message as { content?: string }).content ?? "",
      toolParts: [],
    };
  }, [message]);

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  // Shared markdown components for light + dark mode
  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 className="text-lg font-bold mt-3 mb-2 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-bold mt-3 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h3>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="text-sm">{children}</li>,
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <pre className="mt-2 mb-2 p-3 rounded-lg bg-gray-800 dark:bg-gray-900 text-gray-100 text-xs overflow-x-auto font-mono">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-blue-400 pl-3 my-2 text-gray-600 dark:text-gray-400 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-gray-300 dark:border-gray-700" />,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-600 underline"
      >
        {children}
      </a>
    ),
  };

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar - only for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm [&_a]:text-blue-200 [&_code]:bg-blue-700/50 [&_pre]:bg-blue-700/50 [&_strong]:text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        }`}
      >
        {/* Tool call visual indicators */}
        {toolParts.length > 0 && (
          <div className="mb-3 space-y-2">
            {toolParts.map((tool, idx) => {
              const toolId = `${message.id}-tool-${idx}`;
              const isExpanded = expandedTools.has(toolId);
              const isDone = tool.state === "result";
              const icon = TOOL_ICONS[tool.toolName] || "🔧";
              const nameCn = TOOL_NAMES_CN[tool.toolName] || tool.toolName;

              return (
                <div
                  key={toolId}
                  className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-purple-50/50 dark:bg-purple-950/30"
                >
                  {/* Header - clickable */}
                  <button
                    onClick={() => toggleTool(toolId)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <span className="shrink-0">
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-purple-500">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs">{icon}</span>
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{nameCn}</span>
                    <span className="text-[10px] text-purple-400 font-mono ml-auto">{tool.toolName}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-purple-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Collapsible detail */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-purple-200 dark:border-purple-800">
                      <div>
                        <div className="text-[10px] font-semibold text-purple-500 uppercase mt-2 mb-1">输入参数</div>
                        <pre className="text-[11px] bg-purple-100 dark:bg-purple-900/40 rounded px-2 py-1.5 overflow-x-auto font-mono text-purple-800 dark:text-purple-200 max-h-32 overflow-y-auto">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      </div>
                      {isDone && tool.result !== undefined && (
                        <div>
                          <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase mt-2 mb-1">返回结果</div>
                          <pre className="text-[11px] bg-green-50 dark:bg-green-950/40 rounded px-2 py-1.5 overflow-x-auto font-mono text-green-800 dark:text-green-200 max-h-48 overflow-y-auto">
                            {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isUser ? (
          // User messages: plain text with line breaks
          <p className="whitespace-pre-wrap">{textContent}</p>
        ) : (
          // Assistant messages: full markdown rendering
          textContent ? (
            <ReactMarkdown components={markdownComponents}>
              {textContent}
            </ReactMarkdown>
          ) : toolParts.length > 0 ? (
            <p className="text-gray-400 dark:text-gray-500 italic text-xs">AI 正在使用工具...</p>
          ) : null
        )}
      </div>

      {/* Avatar - only for user */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-600 dark:text-gray-300"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}
