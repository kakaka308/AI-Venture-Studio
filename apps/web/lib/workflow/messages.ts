/**
 * Agent 间通信消息类型
 * 每个 Agent 可以往下游发送消息，下游 Agent 按需消费
 */
export interface AgentMessage {
  /** 发送者 Agent 名称 */
  from: string;
  /** 接收者（"all" 广播，或指定 agent 名） */
  to: string;
  /** 消息类型 */
  type: "warning" | "suggestion" | "question" | "note";
  /** 消息内容 */
  content: string;
}
