import { createLLM } from "../llm";
import type { WorkflowState } from "../state";
import { manageContext } from "../context";

const llm = createLLM();

export async function planningAgentNode(state: typeof WorkflowState.State) {
  const {
    marketReport,
    productRequirements,
    architectureDesign,
    databaseDesign,
    agentMessages,
    revisionTarget,
    revisionNotes,
    revisionCount,
  } = state;

  const isRevision = revisionTarget === "planning" && revisionCount > 0;

  // 消费上游消息
  const relevantMessages = (agentMessages || [])
    .filter((m) => m.to === "planning" || m.to === "all")
    .map((m) => `[${m.from} → ${m.type}]: ${m.content}`)
    .join("\n");

  // 上下文压缩（planning 也接收 4 份上游输出）
  const { sections: compressed } = manageContext(
    [
      { label: "市场分析", content: marketReport },
      { label: "产品需求", content: productRequirements },
      { label: "技术架构", content: architectureDesign },
      { label: "数据库设计", content: databaseDesign },
    ],
    1500
  );
  const ctxMap = Object.fromEntries(compressed.map((s) => [s.label, s.content]));

  const prompt = `
你是一位资深技术项目经理。基于前面的分析，制定详细的开发计划。
${isRevision ? `\n⚠️ 这是第 ${revisionCount} 次修订。审核意见：${revisionNotes}\n请针对性地改进开发计划。` : ""}

市场分析：
${ctxMap["市场分析"]}

产品需求：
${ctxMap["产品需求"]}

技术架构：
${ctxMap["技术架构"]}

数据库设计：
${ctxMap["数据库设计"]}
${relevantMessages ? `\n其他 Agent 的提示：\n${relevantMessages}` : ""}

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
    needsRevision: false,
    revisionNotes: "",
    agentMessages: [
      ...(agentMessages || []),
      {
        from: "planning",
        to: "risk",
        type: "note" as const,
        content: isRevision
          ? `开发计划已完成第 ${revisionCount} 次修订。`
          : `开发计划完成。Sprint 拆分和工时估算已输出，请 Risk Agent 针对关键里程碑进行风险评估。`,
      },
    ],
  };
}
