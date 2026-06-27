import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function pmAgentNode(state: typeof WorkflowState.State) {
  const { projectContext, marketReport } = state;

  const prompt = `
你是一位资深产品经理。基于市场分析结果，输出产品需求文档。

项目信息：
${JSON.stringify(projectContext, null, 2)}

市场分析报告：
${marketReport}

请从以下维度输出 PRD：
1. 产品愿景与核心价值
2. 用户故事（User Stories）
3. 功能需求列表（按优先级排序）
4. 非功能需求
5. MVP 范围建议

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    productRequirements: result.content as string,
    currentStep: "pm_done",
  };
}
