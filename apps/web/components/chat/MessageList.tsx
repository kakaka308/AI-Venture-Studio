"use client";

import { useEffect, useRef, useMemo } from "react";
import type { UIMessage } from "ai";
import MessageBubble from "./MessageBubble";
import ObservabilityPanel from "./ObservabilityPanel";
import type { ObservabilityTrace, ObservabilityEvent } from "@/lib/observability/types";

/** Agent 管线节点 */
interface AgentPipelineStep {
  name: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  duration?: number;
  tokens?: number;
}

/** Agent 管线定义 */
const PIPELINE: { key: string; label: string }[] = [
  { key: "market", label: "市场分析" },
  { key: "pm", label: "产品需求" },
  { key: "architect", label: "技术架构" },
  { key: "database", label: "数据库设计" },
  { key: "planning", label: "开发计划" },
  { key: "risk", label: "风险评估" },
  { key: "reviewer", label: "质量审查" },
  { key: "summarize", label: "报告汇总" },
];

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  /** 可观测性追踪 */
  observabilityTrace?: ObservabilityTrace | null;
  observabilityEvents?: ObservabilityEvent[];
  observabilityConnected?: boolean;
  /** 工作流状态 */
  workflowRunning?: boolean;
  workflowProgress?: Record<string, { status: string; duration?: number; tokens?: number }>;
}

export default function MessageList({
  messages,
  isLoading,
  observabilityTrace = null,
  observabilityEvents = [],
  observabilityConnected = false,
  workflowRunning = false,
  workflowProgress,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 消息更新或流式传输时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, workflowProgress]);

  // 根据进度计算管线步骤状态
  const pipelineSteps = useMemo<AgentPipelineStep[]>(() => {
    if (!workflowProgress || Object.keys(workflowProgress).length === 0) return [];

    return PIPELINE.map((p) => {
      const step = workflowProgress[p.key];
      return {
        name: p.key,
        label: p.label,
        status: (step?.status || "pending") as AgentPipelineStep["status"],
        duration: step?.duration,
        tokens: step?.tokens,
      };
    });
  }, [workflowProgress]);

  // 统计
  const completedCount = pipelineSteps.filter((s) => s.status === "success").length;
  const totalDuration = pipelineSteps.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {messages
        .filter((m) => m.role !== "system")
        .map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
          />
        ))}

      {/* Multi-Agent 工作流进度条 */}
      {workflowRunning && pipelineSteps.length > 0 && (
        <div className="max-w-[85%]">
          <div className="flex gap-3 items-start">
            {/* 头像 */}
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0 relative">
              <div className="absolute inset-0 rounded-full bg-linear-to-brrom-purple-400 to-pink-500 animate-pulse" />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="relative z-10">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>

            {/* 主卡片 */}
            <div className="flex-1 rounded-2xl rounded-tl-sm bg-linear-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border border-purple-200 dark:border-purple-800 overflow-hidden">
              {/* 头部 */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-purple-200/50 dark:border-purple-800/50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-500 rounded-full animate-spin" />
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    Multi-Agent 分析中
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{completedCount}/{PIPELINE.length} 完成</span>
                  <span>⏱ {(totalDuration / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {/* 管线步骤 */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1 flex-wrap">
                  {pipelineSteps.map((step, idx) => (
                    <div key={step.name} className="flex items-center gap-1">
                      {/* 步骤节点 */}
                      <div
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap
                          ${step.status === "success"
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                            : step.status === "running"
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-400"
                            : step.status === "error"
                            ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                          }
                        `}
                      >
                        {step.status === "success" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                        ) : step.status === "running" ? (
                          <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-500 rounded-full animate-spin" />
                        ) : step.status === "error" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                        )}
                        <span>{step.label}</span>
                        {step.duration != null && step.status === "success" && (
                          <span className="text-[10px] opacity-60">
                            {(step.duration / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* 箭头连接线 */}
                      {idx < pipelineSteps.length - 1 && (
                        <svg width="14" height="12" viewBox="0 0 14 12" className="shrink-0 text-gray-300 dark:text-gray-600">
                          <path d="M0 6h10M8 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 底部：可观测性面板 */}
              {observabilityEvents.length > 0 && (
                <div className="px-4 pb-3">
                  <ObservabilityPanel
                    trace={observabilityTrace}
                    events={observabilityEvents}
                    connected={observabilityConnected}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 思考时的加载指示器 + 可观测性面板 */}
      {isLoading && (
        <div className="flex flex-col gap-2 max-w-[80%]">
          <div className="flex gap-3 items-start">
            {/* 动态头像 */}
            <div className="w-8 h-8 rounded-full bg-linear-to-brrom-blue-500 to-purple-600 flex items-center justify-center shrink-0 relative">
              <div className="absolute inset-0 rounded-full bg-linear-to-br from-blue-400 to-purple-500 animate-pulse" />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                className="relative z-10"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            {/* 思考中气泡 */}
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin text-blue-500 shrink-0"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">AI 正在思考...</span>
                <div className="flex items-center gap-1 ml-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          </div>

          {/* 可观测性面板：加载图标下方展示实时调用信息 */}
          {observabilityEvents.length > 0 && observabilityConnected && (
            <div className="ml-11">
              <ObservabilityPanel
                trace={observabilityTrace}
                events={observabilityEvents}
                connected={observabilityConnected}
              />
            </div>
          )}
        </div>
      )}

      {/* 滚动锚点 */}
      <div ref={bottomRef} />
    </div>
  );
}
