"use client";

import { useState, useMemo } from "react";
import {
  Wrench,
  Search,
  ClipboardList,
  Brain,
  CheckSquare,
  Bot,
  GanttChart,
  Database,
  Target,
  Shield,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  XCircle,
  Zap,
  Cpu,
  Activity,
  BarChart3,
  Timer,
  Server,
} from "lucide-react";
import type { ObservabilityTrace, ObservabilityEvent } from "@/lib/observability/types";

// 工具 lucide 图标映射
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  getProjectContext: ClipboardList,
  saveProjectMemory: Brain,
  createTask: CheckSquare,
  searchKnowledgeBase: Search,
};

// Agent lucide 图标映射
const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  market: Target,
  pm: FileText,
  architect: Bot,
  database: Database,
  planning: GanttChart,
  risk: Shield,
  reviewer: Eye,
  summarize: FileText,
};

interface ObservabilityPanelProps {
  trace: ObservabilityTrace | null;
  events: ObservabilityEvent[];
  connected: boolean;
}

/** 格式化时间 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/** 格式化 Token 数 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

/** 安全序列化为字符串 */
function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? "{}";
  } catch {
    return "[序列化失败]";
  }
}

export default function ObservabilityPanel({
  trace,
  events,
  connected,
}: ObservabilityPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // 聚合事件：按 agent/tool 分组
  const aggregatedSteps = useMemo(() => groupSteps(events), [events]);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 计算统计数据
  const { totalTokens, totalDuration, completedSteps } = useMemo(() => {
    // 从最近事件的时间戳计算耗时，避免 Date.now() 在渲染中的纯度问题
    const lastEventTime =
      events.length > 0 ? events[events.length - 1].timestamp : 0;
    return {
      totalTokens: aggregatedSteps.reduce((sum, s) => sum + (s.tokens || 0), 0),
      totalDuration: trace
        ? (trace.endTime || lastEventTime) - trace.startTime
        : 0,
      completedSteps: aggregatedSteps.filter((s) => s.status === "success").length,
    };
  }, [aggregatedSteps, trace, events]);

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      {/* 头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          可观测性面板
        </span>

        {/* 连接状态 */}
        <span
          className={`ml-auto flex items-center gap-1 text-[10px] ${
            connected ? "text-green-500" : "text-red-400"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-400"
            }`}
          />
          {connected ? "已连接" : "已断开"}
        </span>

        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronUp className="w-3 h-3 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* 统计摘要 */}
          {totalDuration > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                <Timer className="w-3 h-3 text-blue-500" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400">耗时</div>
                  <div className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {formatDuration(totalDuration)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                <Zap className="w-3 h-3 text-yellow-500" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400">Token</div>
                  <div className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {totalTokens > 0 ? formatTokens(totalTokens) : "-"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                <Wrench className="w-3 h-3 text-purple-500" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400">步骤</div>
                  <div className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                    {completedSteps}/{aggregatedSteps.length}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                <Server className="w-3 h-3 text-green-500" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400">运行位置</div>
                  <div className="text-[10px] font-mono font-semibold text-green-600 dark:text-green-400 truncate">
                    {trace?.runtime || "Qwen"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 步骤时间线 */}
          {aggregatedSteps.length > 0 && (
            <div className="space-y-1">
              {aggregatedSteps.map((step, idx) => {
                const stepId = `${step.type}-${idx}`;
                const isExpanded = expandedItems.has(stepId);
                const SpecificIcon =
                  step.type === "agent"
                    ? AGENT_ICONS[step.key] || Bot
                    : TOOL_ICONS[step.key] || Wrench;

                return (
                  <div
                    key={stepId}
                    className={`rounded-lg border text-[11px] ${
                      step.status === "running"
                        ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                        : step.status === "error"
                          ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                          : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
                    }`}
                  >
                    <button
                      onClick={() => toggleItem(stepId)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* 状态图标 */}
                      {step.status === "running" ? (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                      ) : step.status === "error" ? (
                        <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                      ) : (
                        <Check className="w-3 h-3 text-green-500 shrink-0" />
                      )}

                      {/* 类型标签 */}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          step.type === "agent"
                            ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                            : "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        {step.type === "agent" ? "Agent" : "Tool"}
                      </span>

                      {/* 名称 + 图标 */}
                      <SpecificIcon className="w-3 h-3 text-gray-500 shrink-0" />
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                        {step.displayName}
                      </span>

                      {/* 耗时 */}
                      {step.duration !== undefined && (
                        <span className="ml-auto font-mono text-[10px] text-gray-400 shrink-0">
                          {formatDuration(step.duration)}
                        </span>
                      )}

                      {/* Token */}
                      {step.tokens && step.tokens > 0 && (
                        <span className="font-mono text-[10px] text-yellow-600 dark:text-yellow-400 shrink-0">
                          {formatTokens(step.tokens)} tok
                        </span>
                      )}

                      {/* 展开箭头 */}
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="px-2.5 pb-2 space-y-1.5 border-t border-gray-200 dark:border-gray-700">
                        {step.args !== undefined && Object.keys(step.args).length > 0 && (
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">输入参数</div>
                            <pre className="text-[10px] bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 overflow-x-auto font-mono text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
                              {safeStringify(step.args)}
                            </pre>
                          </div>
                        )}
                        {step.result != null && (
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">输出结果</div>
                            <pre className="text-[10px] bg-green-50 dark:bg-green-950/30 rounded px-2 py-1 overflow-x-auto font-mono text-green-700 dark:text-green-400 max-h-24 overflow-y-auto">
                              {safeStringify(step.result)}
                            </pre>
                          </div>
                        )}
                        {step.error && (
                          <div>
                            <div className="text-[10px] text-red-400 mb-0.5">错误信息</div>
                            <pre className="text-[10px] bg-red-50 dark:bg-red-950/30 rounded px-2 py-1 font-mono text-red-600 dark:text-red-400">
                              {step.error}
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

          {/* 空状态 */}
          {aggregatedSteps.length === 0 && (
            <div className="flex items-center gap-2 text-[11px] text-gray-400 py-3 justify-center">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>等待 AI 处理开始...</span>
            </div>
          )}

          {/* 底部模型信息 */}
          {trace?.model && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
              <Cpu className="w-3 h-3" />
              <span className="font-mono">{trace.model}</span>
              {trace.runtime && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{trace.runtime}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 步骤聚合
// ============================================================

interface AggregatedStep {
  type: "agent" | "tool";
  key: string;
  displayName: string;
  status: "running" | "success" | "error";
  duration?: number;
  tokens?: number;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

function groupSteps(events: ObservabilityEvent[]): AggregatedStep[] {
  const stepMap = new Map<string, AggregatedStep>();

  for (const event of events) {
    let key = "";
    let type: "agent" | "tool" = "tool";
    let displayName = "";

    if (event.tool) {
      key = event.tool.toolName;
      type = "tool";
      displayName = event.tool.toolNameCn || event.tool.toolName;
    } else if (event.agent) {
      key = event.agent.agentName;
      type = "agent";
      displayName = event.agent.agentNameCn || event.agent.agentName;
    } else {
      continue;
    }

    const existing = stepMap.get(key);

    if (event.type.includes(":start")) {
      stepMap.set(key, {
        type,
        key,
        displayName,
        status: "running",
        args: event.tool?.args,
      });
    } else if (event.type.includes(":end")) {
      if (existing) {
        existing.status = event.tool?.status === "error" || event.agent?.status === "error"
          ? "error"
          : "success";
        existing.duration = event.tool?.duration || event.agent?.duration;
        existing.tokens = event.agent?.tokens || existing.tokens;
        existing.result = event.tool?.result || existing.result;
        existing.error = event.tool?.error || event.agent?.error || existing.error;
      } else {
        stepMap.set(key, {
          type,
          key,
          displayName,
          status: "success",
          duration: event.tool?.duration || event.agent?.duration,
          tokens: event.agent?.tokens,
        });
      }
    }
  }

  return Array.from(stepMap.values());
}
