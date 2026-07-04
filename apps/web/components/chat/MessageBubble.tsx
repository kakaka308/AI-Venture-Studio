"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import type { Components } from "react-markdown";
import {
  Wrench,
  Search,
  ClipboardList,
  Brain,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
} from "lucide-react";

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

// 工具 lucide 图标映射
const TOOL_LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  getProjectContext: ClipboardList,
  saveProjectMemory: Brain,
  createTask: CheckSquare,
  searchKnowledgeBase: Search,
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // 提取文本内容和工具调用部分
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

  const toggleAllTools = () => setToolsExpanded((prev) => !prev);

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  // 亮色/暗色模式共用的 markdown 渲染组件
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

  // 渲染单个工具调用卡片
  const renderToolCard = (tool: {
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
    state: string;
  }, idx: number) => {
    const toolId = `${message.id}-tool-${idx}`;
    const isExpanded = expandedTools.has(toolId);
    const isDone = tool.state === "result";
    const IconComponent = TOOL_LUCIDE_ICONS[tool.toolName] || Wrench;
    const nameCn = TOOL_NAMES_CN[tool.toolName] || tool.toolName;

    return (
      <div
        key={toolId}
        className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-purple-50/50 dark:bg-purple-950/30"
      >
        <button
          onClick={() => toggleTool(toolId)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
        >
          {isDone ? (
            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500 shrink-0" />
          )}
          <IconComponent className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{nameCn}</span>
          <span className="text-[10px] text-purple-400 font-mono ml-auto">{tool.toolName}</span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-purple-400 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-purple-400 shrink-0" />
          )}
        </button>

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
  };

  const showThinkingState = toolParts.length > 0 && !textContent;

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* 头像 - AI 助手 */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
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

      {/* 消息气泡 */}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm [&_a]:text-blue-200 [&_code]:bg-blue-700/50 [&_pre]:bg-blue-700/50 [&_strong]:text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          // 用户消息：纯文本 + 保留换行
          <p className="whitespace-pre-wrap">{textContent}</p>
        ) : showThinkingState ? (
          // 思考状态：直接展示工具调用进度
          <div className="space-y-2">
            {/* 头部：显示进度信息 */}
            <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>AI 正在思考...</span>
              {toolParts.length > 0 && (
                <span className="text-[10px] opacity-70">
                  ({toolParts.filter(t => t.state === "result").length}/{toolParts.length} 个工具)
                </span>
              )}
              <button
                onClick={toggleAllTools}
                className="ml-auto hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded p-0.5 transition-colors"
              >
                {toolsExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* 工具列表 - 始终可见 */}
            <div className="space-y-1.5">
              {toolParts.map((tool, idx) => {
                const IconComponent = TOOL_LUCIDE_ICONS[tool.toolName] || Wrench;
                const nameCn = TOOL_NAMES_CN[tool.toolName] || tool.toolName;
                const isDone = tool.state === "result";

                return (
                  <div key={`${message.id}-tool-${idx}`} className="flex items-center gap-1.5 text-[11px]">
                    {isDone ? (
                      <Check className="w-3 h-3 text-green-500 shrink-0" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin text-purple-500 shrink-0" />
                    )}
                    <IconComponent className="w-3 h-3 text-purple-500 shrink-0" />
                    <span className="text-purple-700 dark:text-purple-300">{nameCn}</span>
                    <span className="text-[10px] text-purple-400 font-mono ml-auto">{tool.toolName}</span>
                  </div>
                );
              })}
            </div>

            {/* 展开后的详情：参数 + 返回结果 */}
            {toolsExpanded && (
              <div className="mt-2 space-y-2">
                {toolParts.map((tool, idx) => renderToolCard(tool, idx))}
              </div>
            )}
          </div>
        ) : textContent ? (
          // AI 文本内容，可选附带已使用工具摘要
          <div>
            {toolParts.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={toggleAllTools}
                  className="flex items-center gap-1.5 text-[10px] text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                >
                  {toolsExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  <span>已使用 {toolParts.length} 个工具</span>
                </button>
                {toolsExpanded && (
                  <div className="mt-2 space-y-2">
                    {toolParts.map((tool, idx) => renderToolCard(tool, idx))}
                  </div>
                )}
              </div>
            )}
            <ReactMarkdown components={markdownComponents}>
              {textContent}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>

      {/* 头像 - 用户 */}
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
