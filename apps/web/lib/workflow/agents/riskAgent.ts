import { createLLM } from "../llm";
import type { WorkflowState } from "../state";
import { manageContext } from "../context";

const llm = createLLM();

export async function riskAgentNode(state: typeof WorkflowState.State) {
  const {
    projectContext,
    marketReport,
    productRequirements,
    architectureDesign,
    databaseDesign,
    taskPlan,
    agentMessages,
    revisionTarget,
    revisionNotes,
    revisionCount,
  } = state;

  const isRevision = revisionTarget === "risk" && revisionCount > 0;

  // 消费上游消息
  const relevantMessages = (agentMessages || [])
    .filter((m) => m.to === "risk" || m.to === "all")
    .map((m) => `[${m.from} → ${m.type}]: ${m.content}`)
    .join("\n");

  // === 上下文压缩 ===
  // risk Agent 接收 6 份上游输出，是管线中最大的 prompt，必须压缩避免超 token 限制
  const { sections: compressed } = manageContext(
    [
      { label: "项目信息", content: JSON.stringify(projectContext, null, 2) },
      { label: "市场分析报告", content: marketReport },
      { label: "产品需求文档", content: productRequirements },
      { label: "技术架构设计", content: architectureDesign },
      { label: "数据库设计", content: databaseDesign || "暂无" },
      { label: "开发计划", content: taskPlan },
    ],
    2000 // prompt 模板自身约 2000 tokens
  );

  const ctxMap = Object.fromEntries(compressed.map((s) => [s.label, s.content]));

  const prompt = `
你是一位资深风险管理专家。基于项目的完整分析，输出全面的风险评估报告。
${isRevision ? `\n⚠️ 这是第 ${revisionCount} 次修订。审核意见：${revisionNotes}\n请针对性地改进风险评估。` : ""}

项目信息：
${ctxMap["项目信息"]}

市场分析报告：
${ctxMap["市场分析报告"]}

产品需求文档：
${ctxMap["产品需求文档"]}

技术架构设计：
${ctxMap["技术架构设计"]}

数据库设计：
${ctxMap["数据库设计"]}

开发计划：
${ctxMap["开发计划"]}
${relevantMessages ? `\n其他 Agent 的提示：\n${relevantMessages}` : ""}

请从以下维度输出风险评估报告：

1. **技术风险**
   - 技术选型风险（成熟度、社区支持、学习曲线）
   - 架构风险（可扩展性、性能瓶颈、单点故障）
   - 数据安全风险（数据泄露、合规性）
   - 技术债务风险评估
   - 集成风险（第三方依赖稳定性）

2. **商业风险**
   - 市场竞争风险（竞争对手动态、市场份额）
   - 商业模式风险（盈利模型验证、定价策略）
   - 用户获取风险（获客成本、转化率预期）
   - 法规合规风险（行业监管、政策变化）
   - 资金链风险（烧钱速度、融资节奏）

3. **运营风险**
   - 团队风险（关键人员依赖、技能缺口）
   - 时间线风险（里程碑延期可能性）
   - 质量风险（测试覆盖、技术债累积）
   - 运维风险（监控、容灾、应急预案）

4. **风险矩阵**
   - 每个风险按"影响程度 × 发生概率"排序
   - 标记高/中/低风险等级

5. **应对策略**
   - 每个高风险项的缓解措施
   - 应急预案
   - 风险监控指标

输出格式：Markdown
`;

  try {
    const result = await llm.invoke(prompt);

    return {
      riskAssessment: result.content as string,
      currentStep: "risk_done",
      agentMessages: [
        ...(agentMessages || []),
        {
          from: "risk",
          to: "reviewer",
          type: "warning" as const,
          content: isRevision
            ? `风险评估已完成第 ${revisionCount} 次修订。`
            : `风险评估完成。识别出关键技术风险和商业风险，请 Reviewer 综合审查全部输出。`,
        },
      ],
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Risk Agent] LLM 调用失败:`, errMsg);

    // 如果是 context too long 错误，给前端返回有用信息
    if (errMsg.includes("context") || errMsg.includes("token") || errMsg.includes("length")) {
      console.error(
        "[Risk Agent] 疑似上下文超限。各输入估算大小:",
        {
          projectContext: (JSON.stringify(projectContext).length * 0.8).toFixed(0),
          marketReport: (marketReport.length * 0.8).toFixed(0),
          productRequirements: (productRequirements.length * 0.8).toFixed(0),
          architectureDesign: (architectureDesign.length * 0.8).toFixed(0),
          databaseDesign: ((databaseDesign || "").length * 0.8).toFixed(0),
          taskPlan: (taskPlan.length * 0.8).toFixed(0),
        },
        "tokens (估算)"
      );
    }

    // 抛出带详细信息的错误，让上层能定位
    throw new Error(`[Risk Agent] 风险评估失败: ${errMsg}`, { cause: error instanceof Error ? error : undefined });
  }
}
