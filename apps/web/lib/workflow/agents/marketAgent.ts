import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function marketAgentNode(state: typeof WorkflowState.State) {
  const { userInput, projectContext, agentMessages } = state;

  // 消费上游消息
  const relevantMessages = (agentMessages || [])
    .filter((m) => m.to === "market" || m.to === "all")
    .map((m) => `[${m.from} → ${m.type}]: ${m.content}`)
    .join("\n");

  const prompt = `
你是一位资深市场分析师。请对以下创业项目进行市场分析。

项目信息：
${JSON.stringify(projectContext, null, 2)}

用户需求：
${userInput}
${relevantMessages ? `\n其他 Agent 的提示：\n${relevantMessages}` : ""}

请从以下维度输出分析报告：
1. 市场规模与增长趋势
2. 目标用户画像
3. 竞争格局分析
4. 市场机会与风险
5. 建议的差异化定位

**关键要求**：
- 每个关键数据（市场规模、增长率、竞品份额、用户特征等）**必须附来源引用**，使用 Markdown 链接格式 \`[来源名称](url)\` 或角标 \`[1]\` \`[2]\`
- 引用数量将直接影响报告质量评分，**至少提供 5 条引用**
- 如无法提供精确数据，请标注"估算"并说明估算依据

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    marketReport: result.content as string,
    currentStep: "market_done",
    agentMessages: [
      ...(agentMessages || []),
      {
        from: "market",
        to: "pm",
        type: "note" as const,
        content: `市场分析完成。关键发现：目标市场规模、用户画像、竞争格局已输出，请基于此设计产品方案。`,
      },
    ],
  };
}
