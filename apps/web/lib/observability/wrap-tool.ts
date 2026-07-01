// ============================================================
// 可观测性工具包装器 - 自动追踪工具调用的计时、参数和结果
// ============================================================

import { observabilityBus } from "./event-bus";
import { TOOL_NAMES_CN } from "./types";

interface ObservabilityToolOptions {
  traceId: string;
  conversationId?: string;
}

/**
 * 包装 AI SDK 工具，自动添加可观测性追踪
 * 使用泛型保持原始类型兼容性
 */
export function wrapToolWithObservability<T extends Record<string, unknown>>(
  tool: T,
  toolName: string,
  options: ObservabilityToolOptions
): T {
  const { traceId, conversationId } = options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalExecute = (tool as any).execute as ((...args: any[]) => any) | undefined;

  if (typeof originalExecute !== "function") {
    return tool;
  }

  const displayName = TOOL_NAMES_CN[toolName] || toolName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrappedExecute = (async (...args: any[]) => {
    const startTime = Date.now();
    const toolArgs = (args[0] as Record<string, unknown>) || {};

    // 发射工具开始事件
    observabilityBus.emitEvent({
      type: "tool:start",
      traceId,
      conversationId,
      timestamp: startTime,
      tool: { toolName, toolNameCn: displayName, args: toolArgs, status: "running" },
      runtime: "Qwen API / Node.js",
      model: "qwen3.6-flash",
    });

    try {
      const result = await originalExecute(...args);
      const duration = Date.now() - startTime;

      observabilityBus.emitEvent({
        type: "tool:end",
        traceId,
        conversationId,
        timestamp: Date.now(),
        tool: { toolName, toolNameCn: displayName, args: toolArgs, result, status: "success", duration },
        runtime: "Qwen API / Node.js",
        model: "qwen3.6-flash",
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      observabilityBus.emitEvent({
        type: "tool:end",
        traceId,
        conversationId,
        timestamp: Date.now(),
        tool: { toolName, toolNameCn: displayName, args: toolArgs, status: "error", duration, error: errorMsg },
        runtime: "Qwen API / Node.js",
        model: "qwen3.6-flash",
      });

      throw error;
    }
  }) as unknown as T[keyof T];

  return { ...tool, execute: wrappedExecute } as unknown as T;
}
