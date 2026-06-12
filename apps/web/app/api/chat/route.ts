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
  const { messages, conversationId } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    conversationId: string;
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

  // 5. 调用 AI 模型（流式），完成后保存 AI 回复
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages,
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

  // 6. 返回流式响应
  return result.toTextStreamResponse();
}