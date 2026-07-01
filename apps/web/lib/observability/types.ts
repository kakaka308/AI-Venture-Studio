// ============================================================
// 可观测性类型定义 - Observability Type Definitions
// ============================================================

/** 工具调用事件 */
export interface ToolEvent {
  toolName: string;
  toolNameCn: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: "running" | "success" | "error";
  duration?: number; // ms
  error?: string;
}

/** Agent 节点事件 */
export interface AgentEvent {
  agentName: string;
  agentNameCn: string;
  status: "running" | "success" | "error";
  duration?: number; // ms
  tokens?: number;
  error?: string;
}

/** 可观测性事件类型 */
export type ObservabilityEventType =
  | "chat:start"
  | "chat:end"
  | "tool:start"
  | "tool:end"
  | "agent:start"
  | "agent:end"
  | "workflow:start"
  | "workflow:end";

/** 可观测性事件 */
export interface ObservabilityEvent {
  type: ObservabilityEventType;
  traceId: string;
  conversationId?: string;
  timestamp: number;

  // 工具事件
  tool?: ToolEvent;

  // Agent 事件
  agent?: AgentEvent;

  // 对话/工作流级别
  totalTokens?: number;
  totalDuration?: number; // ms
  model?: string;
  error?: string;

  // 运行位置
  runtime?: string;
}

/** 工具名称中文映射 */
export const TOOL_NAMES_CN: Record<string, string> = {
  getProjectContext: "获取项目上下文",
  saveProjectMemory: "保存项目记忆",
  createTask: "创建任务",
  searchKnowledgeBase: "搜索知识库",
};

/** Agent 名称中文映射 */
export const AGENT_NAMES_CN: Record<string, string> = {
  market: "市场分析",
  pm: "产品需求",
  architect: "技术架构",
  database: "数据库设计",
  planning: "开发计划",
  risk: "风险评估",
  reviewer: "质量审查",
  summarize: "报告汇总",
};

/** 模型名称中文映射 */
export const MODEL_NAMES_CN: Record<string, string> = {
  "qwen3.6-flash": "通义千问 Qwen3.6-Flash",
  "bge-m3": "BGE-M3 Embedding",
};

/** Trace 记录（聚合一次请求的所有事件） */
export interface ObservabilityTrace {
  traceId: string;
  conversationId?: string;
  startTime: number;
  endTime?: number;
  steps: ObservabilityEvent[];
  model?: string;
  runtime?: string;
}
