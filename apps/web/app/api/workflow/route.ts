import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import type { Prisma } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { runWorkflow } from "@/lib/workflow/runner";
import { observabilityBus } from "@/lib/observability/event-bus";
import { extractAndSaveMemory, extractAndUpdateContext } from "@/lib/memory/extractMemory";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userInput, projectId, conversationId } = await req.json();

  // 读取项目上下文
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { context: true },
  });

  const projectContext = project
    ? {
        name: project.name,
        description: project.description,
        industry: project.industry,
        ...project.context,
      }
    : {};

  const userId = session.user.id; // 提前捕获，避免回调作用域内 TS 报未定义
  const traceId = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const workflowStartTime = Date.now();

  // 发射工作流开始事件
  observabilityBus.emitEvent({
    type: "workflow:start",
    traceId,
    conversationId: projectId,
    timestamp: workflowStartTime,
    model: "qwen3.6-flash",
    runtime: "通义千问 DashScope / Qwen3.6-Flash · Node.js · Multi-Agent",
  });

  // 运行 Workflow（流式返回）
  const stream = await runWorkflow({
    userInput,
    projectContext,
    traceId,
    conversationId: projectId,
  });

  // 用 ReadableStream 包装，实现 SSE
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let finalResult = ""; // 收集 summarize 节点的最终报告
      let qualityReport: Record<string, unknown> | null = null; // 收集 evaluate 节点的质量评分
      const allAgentOutputs: Record<string, string> = {}; // 收集所有 Agent 的输出
      try {
        for await (const event of stream) {
          const nodeName =
            event.metadata?.langgraph_node || event.name || "";

          // 收集所有 Agent 节点的输出（用于兜底构建最终报告）
          if (
            event.event === "on_chain_end" &&
            nodeName &&
            nodeName !== "start" &&
            nodeName !== "__start__"
          ) {
            const output = event.data?.output;
            if (output && typeof output === "object") {
              // 记录该节点的所有字符串字段
              for (const [key, val] of Object.entries(output)) {
                if (
                  typeof val === "string" &&
                  val.length > 20 &&
                  !["currentStep", "revisionTarget"].includes(key)
                ) {
                  allAgentOutputs[key] = val as string;
                }
              }
              // 捕获 evaluate 节点的质量评估报告
              if (output.qualityReport) {
                console.log(
                  `[Workflow] 📊 捕获质量评估报告`,
                );
                qualityReport = output.qualityReport as Record<string, unknown>;
              }
            }
          }

          // 捕获 summarize 节点的输出作为最终报告
          // LangGraph streamEvents v2 中，普通节点的 state 更新在 on_chain_end 事件里
          // 尝试多种路径：event.name、metadata.langgraph_node
          const isSummarizeEnd =
            event.event === "on_chain_end" &&
            (event.name === "summarize" ||
              event.metadata?.langgraph_node === "summarize");

          if (isSummarizeEnd) {
            const output = event.data?.output;
            // 尝试多种可能的嵌套路径
            const result =
              output?.finalResult ||
              output?.output?.finalResult ||
              "";

            if (result) {
              finalResult = result as string;
              console.log(
                `[Workflow] ✅ 捕获 summarize 最终报告，长度: ${finalResult.length} 字符`
              );
            } else {
              // 调试：打印 summarize 事件结构以排查问题
              console.log(
                `[Workflow] ⚠️ summarize 节点完成但未找到 finalResult:`,
                "事件类型:", event.event,
                "output keys:", output ? Object.keys(output) : "null",
                "output 预览:", JSON.stringify(output).slice(0, 300)
              );
            }
          }

          // 每个事件包含节点名称和内容
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // 兜底：如果未能从 summarize 节点捕获到 finalResult，用所有 Agent 输出自行构建报告
        if (!finalResult && Object.keys(allAgentOutputs).length > 0) {
          console.log(
            `[Workflow] ⚠️ 未捕获到 summarize 节点的 finalResult，使用各 Agent 输出构建报告`
          );
          const fallbackReport = buildFallbackReport(allAgentOutputs);
          if (fallbackReport) {
            finalResult = fallbackReport;
          }
        }

        // 发送最终报告给前端（Multi-Agent 分析的核心输出）
        if (finalResult) {
          console.log(
            `[Workflow] 📤 发送 workflow_result 事件，报告长度: ${finalResult.length} 字符`
          );
          const resultEvent = JSON.stringify({
            event: "workflow_result",
            data: { content: finalResult },
          });
          controller.enqueue(encoder.encode(`data: ${resultEvent}\n\n`));

          // 持久化报告：保存到数据库，刷新页面后仍可查看
          if (conversationId) {
            try {
              // 验证对话归属
              const conv = await prisma.conversation.findFirst({
                where: { id: conversationId, userId },
              });
              if (conv) {
                await prisma.message.create({
                  data: {
                    content: finalResult,
                    role: "workflow_report",
                    conversationId: conversationId,
                  },
                });
                console.log(`[Workflow] 💾 报告已保存到对话 ${conversationId}`);
              }

              // ---- Workflow 后处理：自动回写长期记忆和情景文件 ----
              if (projectId) {
                // 合并所有 Agent 产出 + 最终报告，作为抽取素材
                const allOutputsText = [
                  ...Object.values(allAgentOutputs),
                  finalResult,
                ]
                  .filter(Boolean)
                  .join("\n\n---\n\n");

                if (allOutputsText.length > 50) {
                  // 回写到 ProjectMemory（长期记忆/画像）
                  extractAndSaveMemory(prisma, projectId, allOutputsText, 'workflow').catch(
                    (err) => console.error("[Workflow] 记忆回写失败:", err),
                  );
                  // 回写到 ProjectContext（情景文件：问题/价值/竞品/阶段）
                  extractAndUpdateContext(prisma, projectId, allOutputsText).catch(
                    (err) => console.error("[Workflow] 情景回写失败:", err),
                  );
                }

                // ---- 质量评分持久化 ----
                if (qualityReport) {
                  saveQualityReport(
                    prisma,
                    projectId,
                    conversationId,
                    traceId,
                    qualityReport,
                  ).catch((err) =>
                    console.error("[Workflow] 质量评分保存失败:", err),
                  );
                }
              }

              // ---- 发送质量评分卡 SSE 事件 ----
              if (qualityReport) {
                const qualityEvent = JSON.stringify({
                  event: "workflow_quality",
                  data: { qualityReport },
                });
                controller.enqueue(
                  encoder.encode(`data: ${qualityEvent}\n\n`),
                );
                console.log(`[Workflow] 📊 发送 workflow_quality 事件`);
              }
            } catch (saveErr) {
              console.error("[Workflow] 保存报告失败:", saveErr);
            }
          }
        } else {
          console.warn(
            `[Workflow] ⚠️ 无法构建最终报告 - 所有 Agent 输出均为空`
          );
        }

        // 发射工作流完成事件
        const totalDuration = Date.now() - workflowStartTime;
        observabilityBus.emitEvent({
          type: "workflow:end",
          traceId,
          conversationId: projectId,
          timestamp: Date.now(),
          totalDuration,
          model: "qwen3.6-flash",
          runtime: "通义千问 DashScope / Qwen3.6-Flash · Node.js · Multi-Agent",
        });

        controller.close();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Workflow] 工作流执行异常 (traceId=${traceId}):`, err);

        // 发送错误事件给前端
        const errorEvent = JSON.stringify({
          name: "error",
          event: "workflow_error",
          data: { message: errorMessage, traceId },
        });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));

        // 发射工作流结束事件（带错误标记）
        const totalDuration = Date.now() - workflowStartTime;
        observabilityBus.emitEvent({
          type: "workflow:end",
          traceId,
          conversationId: projectId,
          timestamp: Date.now(),
          totalDuration,
          model: "qwen3.6-flash",
          runtime: "通义千问 DashScope / Qwen3.6-Flash · Node.js · Multi-Agent",
          error: errorMessage,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * 兜底函数：当无法从 summarize 节点捕获 finalResult 时，
 * 用各 Agent 的输出自行拼接报告
 */
function buildFallbackReport(outputs: Record<string, string>): string {
  const sections: { title: string; content: string }[] = [];

  const mapping: Record<string, string> = {
    marketReport: "市场分析",
    productRequirements: "产品需求",
    architectureDesign: "技术架构",
    databaseDesign: "数据库设计",
    taskPlan: "开发计划",
    riskAssessment: "风险评估",
  };

  for (const [key, title] of Object.entries(mapping)) {
    if (outputs[key]) {
      sections.push({ title, content: outputs[key] });
    }
  }

  if (sections.length === 0) return "";

  let report = `# 项目分析报告\n\n`;
  for (const { title, content } of sections) {
    report += `## ${title}\n${content}\n\n`;
  }

  if (outputs["agentMessages"]) {
    report += `---\n\n## Agent 协作日志\n${outputs["agentMessages"]}\n`;
  }

  return report;
}

/**
 * 将质量评估报告持久化到 AgentEvaluation 表
 */
async function saveQualityReport(
  prisma: PrismaClient,
  projectId: string,
  conversationId: string | undefined,
  runId: string,
  qualityReport: Record<string, unknown>,
) {
  const entries: Array<{
    agent: string;
    metrics: Prisma.InputJsonValue;
    score: number;
  }> = [];

  // Market Agent
  const market = qualityReport.market as Record<string, unknown> | undefined;
  if (market) {
    entries.push({
      agent: "market",
      metrics: {
        completeness: market.completeness,
        accuracy: market.accuracy,
        citationCount: market.citationCount,
      } as Prisma.InputJsonValue,
      score: (market.overall as number) || 0,
    });
  }

  // PM Agent
  const pm = qualityReport.pm as Record<string, unknown> | undefined;
  if (pm) {
    entries.push({
      agent: "pm",
      metrics: {
        completeness: pm.completeness,
        prdQuality: pm.prdQuality,
        requirementCoverage: pm.requirementCoverage,
        citationCount: pm.citationCount,
      } as Prisma.InputJsonValue,
      score: (pm.overall as number) || 0,
    });
  }

  if (entries.length === 0) return;

  await prisma.agentEvaluation.createMany({
    data: entries.map((e) => ({
      projectId,
      conversationId: conversationId || null,
      runId,
      agent: e.agent,
      metrics: e.metrics,
      score: e.score,
    })),
  });

  console.log(
    `[Workflow] 💾 质量评分已保存: ${entries.map((e) => `${e.agent}=${e.score}/100`).join(", ")}`,
  );
}
