import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { runWorkflow } from "@/lib/workflow/runner";
import { observabilityBus } from "@/lib/observability/event-bus";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userInput, projectId } = await req.json();

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

  // 生成可观测性追踪 ID
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
      for await (const event of stream) {
        // 每个事件包含节点名称和内容
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
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
