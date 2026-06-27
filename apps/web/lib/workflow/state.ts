import { Annotation } from "@langchain/langgraph";

// workflow 全局状态
export const WorkflowState = Annotation.Root({
  userInput: Annotation<string>(),
  projectContext: Annotation<Record<string, unknown>>(),
  // 各 Agent 的输出
  marketReport: Annotation<string>(),
  productRequirements: Annotation<string>(),
  architectureDesign: Annotation<string>(),
  taskPlan: Annotation<string>(),

  currentStep: Annotation<string>(),
  errors: Annotation<string[]>(),
  finalResult: Annotation<string>(),
})