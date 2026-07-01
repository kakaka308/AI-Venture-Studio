import { StateGraph, END, START, Send } from "@langchain/langgraph";
import { WorkflowState } from "./state";
import { marketAgentNode } from "./agents/marketAgent";
import { pmAgentNode } from "./agents/pmAgent";
import { architectAgentNode } from "./agents/architectAgent";
import { databaseAgentNode } from "./agents/databaseAgent";
import { planningAgentNode } from "./agents/planningAgent";
import { riskAgentNode } from "./agents/riskAgent";
import { reviewerAgentNode } from "./agents/reviewerAgent";
import { wrapAgentWithObservability } from "@/lib/observability/wrap-agent";

/**
 * 构建 Multi-Agent Workflow 图
 *
 * 管线：
 *   START → market → pm ─┬→ architect ─┬→ planning → risk → reviewer
 *                         └→ database  ─┘                       │
 *                                              ┌─────────────────┤
 *                                          pass│              fail│
 *                                              ↓                 ↓
 *                                        summarize           back to
 *                                              ↓            target agent
 *                                            END            (max 2 retries)
 *
 * 关键特性：
 *   1. architect 和 database 并行执行（Send API）
 *   2. reviewer 质量审查 + 条件路由回退
 *   3. Agent 间通过 agentMessages 通信
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

    // --- 条件路由：reviewer 决定通过 or 回退 ---
    .addConditionalEdges("reviewer", reviewerRouter)
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
 *   - 通过 → summarize（输出最终报告）
 *   - 不通过 + 未达上限 → 回退到 revisionTarget Agent 重新生成
 *   - 不通过但已达上限 → 强制进入 summarize
 */
function reviewerRouter(state: typeof WorkflowState.State) {
  if (state.needsRevision && state.revisionCount < 3) {
    const target = state.revisionTarget || "pm";
    return target; // 回退到指定 Agent
  }
  return "summarize";
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
  } = state;

  const revisionNote =
    revisionCount > 0
      ? `\n> ⚠️ 本文档经过 ${revisionCount} 轮质量审查与修订。\n`
      : "";

  // 提取 Agent 间的关键通信
  const communicationLog = (agentMessages || [])
    .map((m) => `- **[${m.from} → ${m.to}]** (${m.type}): ${m.content}`)
    .join("\n");

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

## Agent 协作日志
${communicationLog || "无"}
`;

  return {
    finalResult: summary,
    currentStep: "completed",
  };
}
