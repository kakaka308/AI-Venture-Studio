import { buildWorkflow } from "./orchestrator";

export interface RunWorkflowOptions {
  userInput: string;
  projectContext: Record<string, unknown>;
  /** 可观测性追踪 ID */
  traceId?: string;
  /** 对话 ID */
  conversationId?: string;
}

export async function runWorkflow(input: RunWorkflowOptions) {
  const { userInput, projectContext, traceId, conversationId } = input;
  const workflow = buildWorkflow(traceId, conversationId);

  const initialState = {
    userInput,
    projectContext,
    // Agent 输出
    marketReport: "",
    productRequirements: "",
    architectureDesign: "",
    databaseDesign: "",
    taskPlan: "",
    riskAssessment: "",
    // Multi-Agent 通信
    agentMessages: [],
    // Reviewer 反馈闭环
    needsRevision: false,
    revisionTarget: "",
    revisionNotes: "",
    revisionCount: 0,
    // 运行状态
    currentStep: "start",
    errors: [],
    finalResult: "",
  };

  // 流式执行，可以拿到每个节点的输出
  const stream = workflow.streamEvents(initialState, {
    version: "v2",
  });

  return stream;
}

