import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export async function POST(req: NextRequest) {
  // 1. 验证用户登录
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. 解析请求体
  const { messages, conversationId, projectId } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    conversationId: string;
    projectId?: string;
  };

  if (!messages?.length) {
    return new Response("Messages are required", { status: 400 });
  }
  if (!conversationId) {
    return new Response("conversationId is required", { status: 400 });
  }

  // 3. 验证对话归属当前用户（防止越权）
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Conversation not found", { status: 404 });
  }

  // 4. 存储用户消息
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === "user") {
    await prisma.message.create({
      data: {
        content: lastMessage.content,
        role: "user",
        conversationId,
      },
    });
  }

  // 5. 构建 system prompt（注入项目上下文）
  let systemPrompt = "你是一个专业的创业助手 AI Agent。";

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { context: true },
    });

    if (project) {
      const contextLines = [
        `项目名称：${project.name}`,
        project.description && `项目描述：${project.description}`,
        project.industry && `行业：${project.industry}`,
        project.targetAudience && `目标用户：${project.targetAudience}`,
        project.context?.problem && `解决的问题：${project.context.problem}`,
        project.context?.valueProposition && `价值主张：${project.context.valueProposition}`,
        project.context?.competitors && `竞争对手：${project.context.competitors}`,
        project.context?.stage && `项目阶段：${project.context.stage}`,
      ].filter(Boolean);

      if (contextLines.length > 0) {
        systemPrompt += `\n\n你正在分析的创业项目信息如下：\n${contextLines.join("\n")}\n\n请根据以上项目信息，给出专业、有针对性的建议和分析。如果用户请求你做市场调研、产品设计、技术架构设计、数据库设计、风险分析等，请紧密结合这个项目的具体情况来回答。`;
      }
    }
  }

  // 6. 调用 AI 模型（流式），完成后保存 AI 回复
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages,
    system: systemPrompt,
    onFinish: async ({ text }) => {
      try {
        await prisma.message.create({
          data: {
            content: text,
            role: "assistant",
            conversationId,
          },
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      } catch (err) {
        console.error("Failed to persist assistant message:", err);
      }
    },
  });

  // 7. 返回流式响应
  return result.toTextStreamResponse();
}