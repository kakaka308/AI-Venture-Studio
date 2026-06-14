import { getRedis } from "./redis";
import type { PrismaClientType } from "@ai-venture/db";
import { Prisma } from "@ai-venture/db";

// ============================================================
//  短期记忆配置
// ============================================================


const SHORT_TERM_MAX_MSGS = 40;
const SHORT_TERM_TTL = 60 * 60 * 24;

// ============================================================
//  短期记忆逻辑：基于 Redis 列表的最近聊天记录
// ============================================================

// 单条短期消息的 TS 接口结构
export interface ShortTermMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
// 根据会话 ID 生成统一规范的 Redis 键名
function redisKey(conversationId: string) {
  return `chat:${conversationId}:recent`;
}

// 新消息推入 Redis 列表头部
export async function pushRecentMessage(
  conversationId: string,
  msg: ShortTermMessage,
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.log("[Memory] Redis not available, skip pushRecentMessage");
    return;
  }

  try {
    const key = redisKey(conversationId);
    await redis.lpush(key, JSON.stringify(msg)); // 新消息序列化为 JSON 字符串 推入 Redis 列表的头部
    await redis.ltrim(key, 0, SHORT_TERM_MAX_MSGS - 1); // 裁剪列表 保留索引 0 到 39 的元素
    await redis.expire(key, SHORT_TERM_TTL); // 为该键重新设置 24 小时过期时间，防止死数据占用内存
    console.log(
      `[Memory] [OK] Short-term push: role=${msg.role}, convo=${conversationId.slice(0, 8)}...`,
    );
  } catch (err) {
    console.error("[Memory] [FAIL] pushRecentMessage:", err);
  }
}

// 从 Redis 读取最近的 N 条消息
export async function getRecentMessages(
  conversationId: string,
  limit = SHORT_TERM_MAX_MSGS,
): Promise<ShortTermMessage[]> {
  const redis = getRedis();
  if (!redis) {
    console.log("[Memory] Redis not available, skip getRecentMessages");
    return [];
  }

  try {
    const key = redisKey(conversationId);
    const raw = await redis.lrange(key, 0, limit - 1); // 从 Redis 列表中获取指定范围的数据（0 到 limit-1）
    const messages = raw
      .map((item) => JSON.parse(item) as ShortTermMessage)
      .reverse(); // 因为 LPUSH 是倒序插入的（最新消息在最前），所以需要进行反转处理
    console.log(
      `[Memory] [OK] Short-term read: ${messages.length} msgs, convo=${conversationId.slice(0, 8)}...`,
    );
    return messages;
  } catch (err) {
    console.error("[Memory] [FAIL] getRecentMessages:", err);
    return [];
  }
}

// 清除某个会话的短期记忆
export async function clearRecentMessages(
  conversationId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(redisKey(conversationId)); // 直接删除 Redis 中对应的列表键
    console.log(
      `[Memory] [OK] Short-term cleared: convo=${conversationId.slice(0, 8)}...`,
    );
  } catch (err) {
    console.error("[Memory] [FAIL] clearRecentMessages:", err);
  }
}

// ============================================================
//  长期记忆业务逻辑：基于 PostgreSQL 的项目画像持久化
// ============================================================

export interface ProjectPortrait {
  industry: string;
  targetUsers: string;
  businessModel: string;
  /** Key insights the Agent has learned from conversations */
  keyInsights: string[];
  /** Project summary */
  summary: string;
}

const DEFAULT_PORTRAIT: ProjectPortrait = {
  industry: "",
  targetUsers: "",
  businessModel: "",
  keyInsights: [],
  summary: "",
};

// 从数据库的 project_memories 表中读取长期的项目记忆
export async function getProjectMemory(
  prisma: PrismaClientType,
  projectId: string,
): Promise<{
  portrait: ProjectPortrait;
  lastExtractedAt: Date | null;
} | null> {
  try {
    const memory = await prisma.projectMemory.findUnique({
      where: { projectId },
    });
    if (!memory) {
      console.log(
        `[Memory] Long-term: NOT FOUND (projectId=${projectId.slice(0, 8)}...)`,
      );
      return null;
    }

    const portrait =
      typeof memory.portrait === "object" && memory.portrait !== null
        ? { ...DEFAULT_PORTRAIT, ...(memory.portrait as Record<string, unknown>) }
        : DEFAULT_PORTRAIT;

    const industry = portrait.industry || "(empty)";
    const targetUsers = portrait.targetUsers || "(empty)";
    console.log(
      `[Memory] [OK] Long-term read: industry="${industry}", targetUsers="${targetUsers}",` +
        ` insights=${portrait.keyInsights.length} (projectId=${projectId.slice(0, 8)}...)`,
    );

    return {
      portrait,
      lastExtractedAt: memory.lastExtractedAt ?? null,
    };
  } catch (err) {
    console.error("[Memory] [FAIL] getProjectMemory:", err);
    return null;
  }
}

// 更新或创建项目的长期记忆 (Upsert 增量式操作)
export async function upsertProjectMemory(
  prisma: PrismaClientType,
  projectId: string,
  updates: Partial<ProjectPortrait>,
): Promise<void> {
  try {
    // 查询该项目现有的长期记忆
    const existing = await prisma.projectMemory.findUnique({ 
      where: { projectId },
    });
    // if存在旧数据，以旧数据为基础，or默认
    const portrait: ProjectPortrait = existing  
      ? { ...DEFAULT_PORTRAIT, ...(existing.portrait as Record<string, unknown>) }
      : { ...DEFAULT_PORTRAIT };

    // 将传入的增量更新字段逐个覆盖到现有的画像中
    if (updates.industry !== undefined) portrait.industry = updates.industry;
    if (updates.targetUsers !== undefined)
      portrait.targetUsers = updates.targetUsers;
    if (updates.businessModel !== undefined)
      portrait.businessModel = updates.businessModel;
    if (updates.summary !== undefined) portrait.summary = updates.summary;

    // keyInsights特殊处理：去重并追加
    if (updates.keyInsights?.length) {
      const existingInsights = new Set(portrait.keyInsights); 
      for (const insight of updates.keyInsights) {
        existingInsights.add(insight);
      }
      portrait.keyInsights = Array.from(existingInsights);
    }

    // 调用 Prisma 的 upsert 操作：存在则更新 不存在创建
    await prisma.projectMemory.upsert({
      where: { projectId },
      create: {
        projectId,
        portrait: portrait as unknown as Prisma.InputJsonValue,
      },
      update: {
        portrait: portrait as unknown as Prisma.InputJsonValue,
      },
    });

    const industry = portrait.industry || "(empty)";
    console.log(
      `[Memory] [OK] Long-term upserted: industry="${industry}",` +
        ` insights=${portrait.keyInsights.length} (projectId=${projectId.slice(0, 8)}...)`,
    );
  } catch (err) {
    console.error("[Memory] [FAIL] upsertProjectMemory:", err);
  }
}

// ============================================================
//  提示词组装工具 (Prompt Formatting Helpers)
// ============================================================

// 将长期的项目画像数据格式化为可以嵌入到 System Prompt（系统提示词）中的文本片段
export function formatPortraitAsPrompt(portrait: ProjectPortrait): string {
  const lines: string[] = [];

  // 如果各字段有内容，则以结构化的行文本形式放入数组中
  if (portrait.industry) {
    lines.push("Industry: " + portrait.industry);
  }
  if (portrait.targetUsers) {
    lines.push("Target Users: " + portrait.targetUsers);
  }
  if (portrait.businessModel) {
    lines.push("Business Model: " + portrait.businessModel);
  }

  // 格式化洞察数组，将其变成用 “- ” 引导的 Markdown 列表形式
  if (portrait.keyInsights.length > 0) {
    lines.push(
      "Key Insights:\n" +
        portrait.keyInsights.map((i) => "  - " + i).join("\n"),
    );
  }

  if (portrait.summary) {
    lines.push("Project Summary: " + portrait.summary);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

// 将短期的 Redis 历史消息列表格式化为适合注入 LLM 上下文的文本片段
export function formatRecentAsPrompt(messages: ShortTermMessage[]): string {
  if (messages.length === 0) return "";
  return messages
    .map(
      (m) =>
        (m.role === "user" ? "User" : "AI") + ": " + m.content,
    )
    .join("\n");
}
