// ============================================================
// 可观测性 Agent 包装器 - 自动追踪 Agent 节点的执行计时
// ============================================================

import { observabilityBus } from "./event-bus";
import { AGENT_NAMES_CN } from "./types";

interface ObservabilityAgentOptions {
  traceId: string;
  conversationId?: string;
}

/**
 * 包装 LangGraph Agent 节点函数，添加可观测性追踪
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapAgentWithObservability<T extends (...args: any[]) => any>(
  nodeFn: T,
  agentName: string,
  options: ObservabilityAgentOptions
): T {
  const { traceId, conversationId } = options;
  const displayName = AGENT_NAMES_CN[agentName] || agentName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrappedFn = async (...args: any[]) => {
    const startTime = Date.now();

    // 发射 Agent 开始事件
    observabilityBus.emitEvent({
      type: "agent:start",
      traceId,
      conversationId,
      timestamp: startTime,
      agent: {
        agentName,
        agentNameCn: displayName,
        status: "running",
      },
      model: "qwen3.6-flash",
      runtime: "通义千问 DashScope / Qwen3.6-Flash · Node.js",
    });

    try {
      const result = await nodeFn(...args);
      const duration = Date.now() - startTime;

      // 发射 Agent 完成事件
      observabilityBus.emitEvent({
        type: "agent:end",
        traceId,
        conversationId,
        timestamp: Date.now(),
        agent: {
          agentName,
          agentNameCn: displayName,
          status: "success",
          duration,
          tokens: estimateTokens(result),
        },
        model: "qwen3.6-flash",
        runtime: "通义千问 DashScope / Qwen3.6-Flash · Node.js",
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 发射 Agent 错误事件
      observabilityBus.emitEvent({
        type: "agent:end",
        traceId,
        conversationId,
        timestamp: Date.now(),
        agent: {
          agentName,
          agentNameCn: displayName,
          status: "error",
          duration,
          error: errorMsg,
        },
        model: "qwen3.6-flash",
        runtime: "通义千问 DashScope / Qwen3.6-Flash · Node.js",
      });

      throw error;
    }
  };

  return wrappedFn as T;
}

/**
 * 粗略估算 token 数（中文字符约 1.5 token/字，英文约 0.75 token/字）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimateTokens(result: any): number {
  let totalChars = 0;
  if (typeof result === "string") {
    totalChars += result.length;
  } else if (typeof result === "object" && result !== null) {
    for (const val of Object.values(result)) {
      if (typeof val === "string") {
        totalChars += val.length;
      }
    }
  }
  return Math.round(totalChars * 0.8);
}
