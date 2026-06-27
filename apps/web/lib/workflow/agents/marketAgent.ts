import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function marketAgentNode(state: typeof WorkflowState.State) {
  const { userInput, projectContext } = state;

  const prompt = `
你是一位资深市场分析师。请对以下创业项目进行市场分析。

项目信息：
${JSON.stringify(projectContext, null, 2)}

用户需求：
${userInput}

请从以下维度输出分析报告：
1. 市场规模与增长趋势
2. 目标用户画像
3. 竞争格局分析
4. 市场机会与风险
5. 建议的差异化定位

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    marketReport: result.content as string,
    currentStep: "market_done",
  };
}
