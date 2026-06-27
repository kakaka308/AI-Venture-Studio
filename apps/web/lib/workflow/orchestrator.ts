import { StateGraph, END, START } from "@langchain/langgraph";
import { WorkflowState } from "./state";
import { marketAgentNode } from "./agents/marketAgent";
import { pmAgentNode } from "./agents/pmAgent";
import { architectAgentNode } from "./agents/architectAgent";
import { planningAgentNode } from "./agents/planningAgent";

/**
 * 构建 workflow 图
 *
 * 类型链: 每个 addNode/addEdge 返回新的泛型 N，必须链式调用
 * 否则 TypeScript 认为 N 始终是 "__start__"，导致后续 addEdge 报错
 */
export function buildWorkflow() {
  return new StateGraph(WorkflowState)
    .addNode("market", marketAgentNode)
    .addNode("pm", pmAgentNode)
    .addNode("architect", architectAgentNode)
    .addNode("planning", planningAgentNode)
    .addNode("summarize", summarizeNode)
    .addEdge(START, "market")
    .addEdge("market", "pm")
    .addEdge("pm", "architect")
    .addEdge("architect", "planning")
    .addEdge("planning", "summarize")
    .addEdge("summarize", END)
    .compile();
}

async function summarizeNode(state: typeof WorkflowState.State) {
  const { marketReport, productRequirements, architectureDesign, taskPlan } = state;

  const summary = `
# 项目分析报告

## 市场分析
${marketReport || "暂无数据"}

## 产品需求
${productRequirements || "暂无数据"}

## 技术架构
${architectureDesign || "暂无数据"}

## 开发计划
${taskPlan || "暂无数据"}
`;

  return {
    finalResult: summary,
    currentStep: "completed",
  };
}
