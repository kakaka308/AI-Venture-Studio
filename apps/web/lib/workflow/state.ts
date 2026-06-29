import { Annotation } from "@langchain/langgraph";
import type { AgentMessage } from "./messages";

// workflow 全局状态
export const WorkflowState = Annotation.Root({
  userInput: Annotation<string>(),
  projectContext: Annotation<Record<string, unknown>>(),

  // 各 Agent 的输出
  marketReport: Annotation<string>(),
  productRequirements: Annotation<string>(),
  architectureDesign: Annotation<string>(),
  databaseDesign: Annotation<string>(),
  taskPlan: Annotation<string>(),
  riskAssessment: Annotation<string>(),

  // Multi-Agent 通信 --- 消息总线（追加合并）
  agentMessages: Annotation<AgentMessage[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),

  // Reviewer 反馈闭环相关
  needsRevision: Annotation<boolean>(),
  revisionTarget: Annotation<string>(),
  revisionNotes: Annotation<string>(),
  revisionCount: Annotation<number>(),

  // 运行状态
  currentStep: Annotation<string>(),
  errors: Annotation<string[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
    default: () => [],
  }),
  finalResult: Annotation<string>(),
});
