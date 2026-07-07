import { StateGraph, END, START, Send } from "@langchain/langgraph";
import { WorkflowState } from "./state";
import { marketAgentNode } from "./agents/marketAgent";
import { pmAgentNode } from "./agents/pmAgent";
import { architectAgentNode } from "./agents/architectAgent";
import { databaseAgentNode } from "./agents/databaseAgent";
import { planningAgentNode } from "./agents/planningAgent";
import { riskAgentNode } from "./agents/riskAgent";
import { reviewerAgentNode } from "./agents/reviewerAgent";
import { evaluationAgentNode } from "./agents/evaluationAgent";
import { wrapAgentWithObservability } from "@/lib/observability/wrap-agent";
import type { QualityReport } from "./evaluation/types";

/**
 * 构建 Multi-Agent Workflow 图
 *
 * 管线：
 *   START → market → pm ─┬→ architect ─┬→ planning → risk → reviewer
 *                         └→ database  ─┘                       │
 *                                              ┌─────────────────┤
 *                                          pass│              fail│
 *                                              ↓                 ↓
 *                                          evaluate           back to
 *                                              ↓            target agent
 *                                          summarize        (max 2 retries)
 *                                              ↓
 *                                            END
 *
 * 关键特性：
 *   1. architect 和 database 并行执行（Send API）
 *   2. reviewer 质量审查 + 条件路由回退
 *   3. evaluate 逐 Agent 可衡量评分（确定性+LLM 双轨）
 *   4. summarize 汇总报告 + 质量评分卡
 *   5. Agent 间通过 agentMessages 通信
 */
export function buildWorkflow(traceId?: string, conversationId?: string) {
  const opts = { traceId: traceId || "workflow", conversationId };

  return new StateGraph(WorkflowState)
    // --- 注册所有节点（带可观测性包装）---
    .addNode("market", traceId
      ? wrapAgentWithObservability(marketAgentNode, "market", opts)
      : marketAgentNode)
    .addNode("pm", traceId
      ? wrapAgentWithObservability(pmAgentNode, "pm", opts)
      : pmAgentNode)
    .addNode("architect", traceId
      ? wrapAgentWithObservability(architectAgentNode, "architect", opts)
      : architectAgentNode)
    .addNode("database", traceId
      ? wrapAgentWithObservability(databaseAgentNode, "database", opts)
      : databaseAgentNode)
    .addNode("planning", traceId
      ? wrapAgentWithObservability(planningAgentNode, "planning", opts)
      : planningAgentNode)
    .addNode("risk", traceId
      ? wrapAgentWithObservability(riskAgentNode, "risk", opts)
      : riskAgentNode)
    .addNode("reviewer", traceId
      ? wrapAgentWithObservability(reviewerAgentNode, "reviewer", opts)
      : reviewerAgentNode)
    .addNode("evaluate", traceId
      ? wrapAgentWithObservability(evaluationAgentNode, "evaluate", opts)
      : evaluationAgentNode)
    .addNode("summarize", traceId
      ? wrapAgentWithObservability(summarizeNode, "summarize", opts)
      : summarizeNode)

    // --- 顺序阶段 ---
    .addEdge(START, "market")
    .addEdge("market", "pm")

    // --- 并行分支：pm 同时分发到 architect 和 database ---
    .addConditionalEdges("pm", fanOutArchitectDatabase)

    // --- 汇聚：architect 和 database 都完成后才进入 planning ---
    .addEdge("architect", "planning")
    .addEdge("database", "planning")

    // --- 顺序收尾 ---
    .addEdge("planning", "risk")
    .addEdge("risk", "reviewer")

    // --- 条件路由：reviewer → evaluate(pass) / revisionTarget(fail) ---
    .addConditionalEdges("reviewer", reviewerRouter)
    .addEdge("evaluate", "summarize")
    .addEdge("summarize", END)

    .compile();
}

// ============================================================
// 路由函数
// ============================================================

/**
 * pm 完成后，同时启动 architect 和 database（并行）
 */
function fanOutArchitectDatabase(state: typeof WorkflowState.State) {
  return [
    new Send("architect", state),
    new Send("database", state),
  ];
}

/**
 * reviewer 完成后：
 *   - 通过 → evaluate（质量评估评分卡）
 *   - 不通过 + 未达上限 → 回退到 revisionTarget Agent 重新生成
 *   - 不通过但已达上限 → 强制进入 evaluate
 */
function reviewerRouter(state: typeof WorkflowState.State) {
  if (state.needsRevision && state.revisionCount < 3) {
    const target = state.revisionTarget || "pm";
    return target; // 回退到指定 Agent
  }
  return "evaluate";
}

// ============================================================
// 汇总节点
// ============================================================

async function summarizeNode(state: typeof WorkflowState.State) {
  const {
    marketReport,
    productRequirements,
    architectureDesign,
    databaseDesign,
    taskPlan,
    riskAssessment,
    agentMessages,
    revisionCount,
    qualityReport,
  } = state;

  const revisionNote =
    revisionCount > 0
      ? `\n> ⚠️ 本文档经过 ${revisionCount} 轮质量审查与修订。\n`
      : "";

  // 提取 Agent 间的关键通信
  const communicationLog = (agentMessages || [])
    .map((m) => `- **[${m.from} → ${m.to}]** (${m.type}): ${m.content}`)
    .join("\n");

  // ---- 质量评分卡 ----
  const scorecard = buildScorecard(qualityReport);

  const summary = `
# 项目分析报告
${revisionNote}
## 市场分析
${marketReport || "暂无数据"}

## 产品需求
${productRequirements || "暂无数据"}

## 技术架构
${architectureDesign || "暂无数据"}

## 数据库设计
${databaseDesign || "暂无数据"}

## 开发计划
${taskPlan || "暂无数据"}

## 风险评估
${riskAssessment || "暂无数据"}

---

${scorecard}

## Agent 协作日志
${communicationLog || "无"}
`;

  return {
    finalResult: summary,
    currentStep: "completed",
  };
}

// ---- 评分卡构建 ----

function buildScorecard(report: QualityReport | null): string {
  if (!report) return "## 质量评分卡\n\n> 暂无评分数据。\n";

  const { market, pm, architect, database, planning, risk, overall } = report;

  // 空值保护：任一核心 Agent 评分缺失时降级提示，避免 undefined 访问崩溃
  if (!market || !pm || !architect || !database || !planning || !risk) {
    return "## 质量评分卡\n\n> 评分数据不完整，无法渲染。\n";
  }

  const overallEmoji = overall >= 85 ? "🟢" : overall >= 70 ? "🟡" : "🔴";

  return `
## 质量评分卡

### 综合评分: ${overall}/100 ${overallEmoji}

| Agent | 维度 | 分数 | 类型 |
|-------|------|------|------|
| **Market Agent** | 完整度 | ${market.completeness}/100 | 确定性 |
| | 准确度 | ${market.accuracy}/100 | LLM 语义 |
| | 引用数量 | ${market.citationCount} 条 | 确定性 |
| | **Market 总分** | **${market.overall}/100** | |
| **PM Agent** | 完整度 | ${pm.completeness}/100 | 确定性 |
| | PRD 质量 | ${pm.prdQuality}/100 | LLM 语义 |
| | 需求覆盖率 | ${pm.requirementCoverage}/100 | 混合 |
| | **PM 总分** | **${pm.overall}/100** | |
| **Architect Agent** | 完整度 | ${architect.completeness}/100 | 确定性 |
| | 可行性 | ${architect.feasibility}/100 | LLM 语义 |
| | 技术风险评估 | ${architect.techRisk}/100 | LLM 语义 |
| | **架构总分** | **${architect.overall}/100** | |
| **Database Agent** | 完整度 | ${database.completeness}/100 | 确定性 |
| | 设计规范化 | ${database.normalization}/100 | LLM 语义 |
| | 引用数量 | ${database.citationCount} 条 | 确定性 |
| | **数据库总分** | **${database.overall}/100** | |
| **Planning Agent** | 完整度 | ${planning.completeness}/100 | 确定性 |
| | 可落地性 | ${planning.executability}/100 | LLM 语义 |
| | 工时估算 | ${planning.estimation}/100 | LLM 语义 |
| | **计划总分** | **${planning.overall}/100** | |
| **Risk Agent** | 完整度 | ${risk.completeness}/100 | 确定性 |
| | 风险覆盖度 | ${risk.coverage}/100 | LLM 语义 |
| | 引用数量 | ${risk.citationCount} 条 | 确定性 |
| | **风险总分** | **${risk.overall}/100** | |

> 💡 **评分说明**：确定性指标通过程序计算（可复现），LLM 语义指标通过 AI 评审。引用数量反映报告的可靠性和可验证性。
`;
}
