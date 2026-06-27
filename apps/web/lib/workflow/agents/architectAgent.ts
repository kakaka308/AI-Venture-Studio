import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function architectAgentNode(state: typeof WorkflowState.State) {
  const { projectContext, marketReport, productRequirements } = state;

  const prompt = `
你是一位资深技术架构师。基于产品需求，设计技术架构方案。

产品需求文档：
${productRequirements}

市场背景：
${marketReport}

项目信息：
${JSON.stringify(projectContext, null, 2)}

请从以下维度输出架构设计：
1. 系统架构图（用文字描述各模块）
2. 技术栈建议
3. 数据库设计思路
4. API 设计思路
5. 部署与运维方案
6. 技术风险评估

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    architectureDesign: result.content as string,
    currentStep: "architect_done",
  };
}
