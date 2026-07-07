import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function pmAgentNode(state: typeof WorkflowState.State) {
  const {
    projectContext,
    marketReport,
    agentMessages,
    revisionTarget,
    revisionNotes,
    revisionCount,
  } = state;

  const isRevision = revisionTarget === "pm" && revisionCount > 0;

  // 消费上游消息
  const relevantMessages = (agentMessages || [])
    .filter((m) => m.to === "pm" || m.to === "all")
    .map((m) => `[${m.from} → ${m.type}]: ${m.content}`)
    .join("\n");

  const prompt = `
你是一位资深产品经理。基于市场分析结果，输出产品需求文档。
${isRevision ? `\n⚠️ 这是第 ${revisionCount} 次修订。审核意见：${revisionNotes}\n请针对性地改进以下内容。` : ""}

项目信息：
${JSON.stringify(projectContext, null, 2)}

市场分析报告：
${marketReport}
${relevantMessages ? `\n其他 Agent 的提示：\n${relevantMessages}` : ""}

请从以下维度输出 PRD：
1. 产品愿景与核心价值
2. 用户故事（User Stories）
3. 功能需求列表（按优先级排序）
4. 非功能需求
5. MVP 范围建议

**关键要求**：
- 功能需求需**标注溯源自市场分析的哪条诉求**，例如"（溯源：市场分析-第X点-XX机会）"
- 确保 PRD 覆盖市场分析中识别到的核心痛点和机会
- 需求覆盖率将直接影响产品质量评分

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    productRequirements: result.content as string,
    currentStep: "pm_done",
    agentMessages: [
      ...(agentMessages || []),
      {
        from: "pm",
        to: "all",
        type: "note" as const,
        content: isRevision
          ? `PRD 已完成第 ${revisionCount} 次修订。`
          : `PRD 已完成。功能需求已按优先级排序，请架构师和数据库设计师基于此进行设计。`,
      },
    ],
  };
}
