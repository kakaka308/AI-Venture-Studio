import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { stepCountIs, streamText, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// 通义千问 API（OpenAI 兼容模式）
const qwen = createOpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY,
});
import { NextRequest } from "next/server";
import {
  getRecentMessages,
  pushRecentMessage,
  getProjectMemory,
  formatPortraitAsPrompt,
  formatRecentAsPrompt,
} from "@/lib/memory";
import { getProjectContext } from "@/lib/tools/getProjectContext";
import { saveProjectMemory } from "@/lib/tools/saveProjectMemory";
import { createTask } from "@/lib/tools/createTask";
import { searchKnowledgeBase } from "@/lib/tools/searchKnowledgeBase";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 提取消息文本（兼容 string content 和 parts/content 数组格式）
function getMessageText(msg: Record<string, unknown>): string {
  const content = msg.content;
  const parts = msg.parts;

  if (Array.isArray(content)) {
    return content
      .filter((p: Record<string, unknown>) => p.type === "text")
      .map((p: Record<string, unknown>) => (p.text as string) ?? "")
      .join("");
  }
  if (Array.isArray(parts)) {
    return parts
      .filter((p: Record<string, unknown>) => p.type === "text")
      .map((p: Record<string, unknown>) => (p.text as string) ?? "")
      .join("");
  }
  return typeof content === "string" ? content : "";
}

export async function POST(req: NextRequest) {
  // 验证用户登录
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 解析请求体
  const body = await req.json();
  const { messages: rawMessages, conversationId, projectId } = body as {
    messages: Record<string, unknown>[];
    conversationId: string;
    projectId?: string;
  };

  // 规范化消息格式：AI SDK v6 客户端使用 parts[]，但服务端 streamText 期望 content（string | array）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = rawMessages.map((msg): any => {
    // 如果已有 content 字段，直接使用
    if ("content" in msg && msg.content !== undefined) {
      return msg;
    }
    // 将 parts[] 转成 content 格式
    if ("parts" in msg && Array.isArray(msg.parts)) {
      const { parts, ...rest } = msg;
      return { ...rest, content: parts };
    }
    return msg;
  }) as ModelMessage[];

  console.log("[Chat API] 收到请求, messages:", JSON.stringify(messages).slice(0, 200));

  if (!messages?.length) {
    return new Response("Messages are required", { status: 400 });
  }
  if (!conversationId) {
    return new Response("conversationId is required", { status: 400 });
  }

  //  验证对话归属当前用户（防止越权）
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Conversation not found", { status: 404 });
  }

  // 存储用户消息
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === "user") {
    const userContent = getMessageText(lastMessage);
    await prisma.message.create({
      data: {
        content: userContent,
        role: "user",
        conversationId,
      },
    });

    // ---- 短期记忆：推送用户消息到 Redis ----
    pushRecentMessage(conversationId, {
      role: "user",
      content: userContent,
      createdAt: new Date().toISOString(),
    }).catch((err) => console.error("[Memory] 推送用户消息失败:", err));
  }

  // 构建 system prompt（项目上下文 + 短期记忆 + 长期记忆）
  let systemPrompt = "你是一个专业的创业助手 AI Agent。";

  // 项目基础信息
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
        systemPrompt += `\n\n你正在分析的创业项目信息如下：\n${contextLines.join("\n")}`;
      }
    }

    // 长期记忆：项目画像
    const projectMemory = await getProjectMemory(prisma, projectId);
    if (projectMemory?.portrait) {
      const portraitText = formatPortraitAsPrompt(projectMemory.portrait);
      if (portraitText) {
        systemPrompt += `\n\n## 项目画像（Agent 持续学习）\n${portraitText}\n\n以上是你从历史对话中学到的项目知识，请在回答时利用这些洞察。`;
        console.log("[Memory] ✓ 长期记忆已注入到 system prompt");
      } else {
        console.log("[Memory] 长期记忆为空，跳过注入");
      }
    } else {
      console.log("[Memory] 无长期记忆数据，跳过注入");
    }
  }

  // 短期记忆：最近对话历史
  const recent = await getRecentMessages(conversationId);
  if (recent.length > 0) {
    const recentText = formatRecentAsPrompt(recent);
    if (recentText) {
      systemPrompt += `\n\n## 最近你与该用户的对话历史\n${recentText}\n\n以上是最近的上下文，请在回答时保持连贯。`;
      console.log(`[Memory] ✓ 短期记忆已注入 (${recent.length} 条消息)`);
    }
  } else {
    console.log("[Memory] 无短期记忆，跳过注入");
  }

  systemPrompt += `\n\n请根据以上信息，给出专业、有针对性的建议和分析。如果用户请求你做市场调研、产品设计、技术架构设计、数据库设计、风险分析等，请紧密结合这个项目的具体情况来回答。`;

  // 调用 AI 模型（流式），完成后保存 AI 回复并更新记忆
  console.log("[Chat API] 开始调用模型:", "qwen3.6-flash", "消息数:", messages.length);
  try {
    const result = streamText({
      model: qwen("qwen3.6-flash"),
      messages,
      system: systemPrompt,
      // 禁用推理模式：qwen3.6-flash 默认返回 reasoning_content（思考过程）
      // 大部分 chunk 的 content 为 null，导致 AI SDK 的 OpenAI provider 无法正确解析文本内容
      providerOptions: {
        openai: {
          extraBody: {
            enable_thinking: false,
          },
        },
      },
      // 工具配置 
      tools: {
        getProjectContext: getProjectContext(prisma),
        saveProjectMemory: saveProjectMemory(prisma),
        createTask: createTask(prisma),
        searchKnowledgeBase: searchKnowledgeBase(prisma),
      },
      stopWhen: stepCountIs(5),
      onFinish: async ({ text }) => {
        console.log("[Chat API] 模型返回完成，响应长度:", text?.length);
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

          // ---- 短期记忆：推送 AI 回复到 Redis ----
          pushRecentMessage(conversationId, {
            role: "assistant",
            content: text,
            createdAt: new Date().toISOString(),
          }).then(() => {
            console.log("[Memory] ✓ AI 回复已推送到短期记忆");
          }).catch((err) => console.error("[Memory] 推送 AI 回复失败:", err));
        } catch (err) {
          console.error("Failed to persist assistant message:", err);
        }
      },
    });

    // 返回 UI 消息流响应（配合客户端 useChat + DefaultChatTransport 使用）
    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[Chat API] 调用 AI 模型失败:", err);
    return new Response(
      JSON.stringify({ error: "AI 模型调用失败，请检查 API Key 和模型名称" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
