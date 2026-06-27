import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function planningAgentNode(state: typeof WorkflowState.State) {
  const {
    marketReport,
    productRequirements,
    architectureDesign,
  } = state;

  const prompt = `
你是一位资深技术项目经理。基于前面的分析，制定详细的开发计划。

市场分析：
${marketReport}

产品需求：
${productRequirements}

技术架构：
${architectureDesign}

请输出：
1. 项目里程碑（Milestone）划分
2. 每个里程碑的任务拆解
3. 预估工时
4. 依赖关系
5. 风险与应对措施

以 JSON 格式输出任务列表，每个任务包含：title, description, estimatedHours, priority, milestone
`;

  const result = await llm.invoke(prompt);

  return {
    taskPlan: result.content as string,
    currentStep: "planning_done",
  };
}
