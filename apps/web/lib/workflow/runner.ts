import { buildWorkflow } from "./orchestrator";

export async function runWorkflow(input: {
  userInput: string;
  projectContext: Record<string, unknown>;
}) {
  const workflow = buildWorkflow();

  const initialState = {
    userInput: input.userInput,
    projectContext: input.projectContext,
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
