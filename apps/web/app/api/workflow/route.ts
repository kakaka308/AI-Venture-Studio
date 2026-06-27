import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { runWorkflow } from "@/lib/workflow/runner";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export async function POST(req: NextRequest) {
  // 1. 认证
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. 解析请求
  const { projectId, userInput } = await req.json();

  if (!projectId || !userInput) {
    return new Response("Missing projectId or userInput", { status: 400 });
  }

  // 3. 查询项目上下文
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectContext: true,
    },
  });

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  // 4. 权限校验
  if (project.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // 5. 组装项目上下文
  const projectContext = {
    name: project.name,
    description: project.description,
    industry: project.projectContext?.industry,
    targetUsers: project.projectContext?.targetUsers,
    problem: project.projectContext?.problem,
    valueProposition: project.projectContext?.valueProposition,
    competitors: project.projectContext?.competitors,
    stage: project.projectContext?.stage,
  };

  // 6. 启动工作流，获取 LangGraph 流
  const stream = await runWorkflow({
    userInput,
    projectContext,
  });

  // 7. SSE（Server-Sent Events）流式返回
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ event: "error", data: errMsg })}\n\n`
          )
        );
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
