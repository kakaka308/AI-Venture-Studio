import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function architectAgentNode(state: typeof WorkflowState.State) {
  const {
    projectContext,
    marketReport,
    productRequirements,
    agentMessages,
    revisionTarget,
    revisionNotes,
    revisionCount,
  } = state;

  const isRevision = revisionTarget === "architect" && revisionCount > 0;

  // 消费上游消息
  const relevantMessages = (agentMessages || [])
    .filter((m) => m.to === "architect" || m.to === "all")
    .map((m) => `[${m.from} → ${m.type}]: ${m.content}`)
    .join("\n");

  const prompt = `
你是一位资深技术架构师。基于产品需求，设计技术架构方案。
${isRevision ? `\n⚠️ 这是第 ${revisionCount} 次修订。审核意见：${revisionNotes}\n请针对性地改进架构设计。` : ""}

产品需求文档：
${productRequirements}

市场背景：
${marketReport}

项目信息：
${JSON.stringify(projectContext, null, 2)}
${relevantMessages ? `\n其他 Agent 的提示：\n${relevantMessages}` : ""}

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
    needsRevision: false,
    revisionNotes: "",
    agentMessages: [
      ...(agentMessages || []),
      {
        from: "architect",
        to: "planning",
        type: "suggestion" as const,
        content: isRevision
          ? `架构设计已完成第 ${revisionCount} 次修订。`
          : `技术架构设计完成。技术栈和模块划分已确定，数据库设计人员可参考补充。建议 Planning Agent 重点关注基础设施搭建阶段。`,
      },
    ],
  };
}
