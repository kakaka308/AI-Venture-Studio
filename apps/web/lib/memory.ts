import { getRedis } from "./redis";
import type { PrismaClientType } from "@ai-venture/db";
import { Prisma } from "@ai-venture/db";

// ============================================================
//  Short-term memory config
// ============================================================

/** Max messages per conversation cached in Redis */
const SHORT_TERM_MAX_MSGS = 40;
/** Redis key TTL (seconds), default 24h */
const SHORT_TERM_TTL = 60 * 60 * 24;

// ============================================================
//  Short-term memory (Redis): recent chat history
// ============================================================

export interface ShortTermMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string; // ISO string
}

function redisKey(conversationId: string) {
  return `chat:${conversationId}:recent`;
}

/**
 * Push a message to the head of the Redis list, trim length
 */
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
    await redis.lpush(key, JSON.stringify(msg));
    await redis.ltrim(key, 0, SHORT_TERM_MAX_MSGS - 1);
    await redis.expire(key, SHORT_TERM_TTL);
    console.log(
      `[Memory] [OK] Short-term push: role=${msg.role}, convo=${conversationId.slice(0, 8)}...`,
    );
  } catch (err) {
    console.error("[Memory] [FAIL] pushRecentMessage:", err);
  }
}

/**
 * Read recent N messages from Redis (chronological order)
 */
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
    const raw = await redis.lrange(key, 0, limit - 1);
    const messages = raw
      .map((item) => JSON.parse(item) as ShortTermMessage)
      .reverse();
    console.log(
      `[Memory] [OK] Short-term read: ${messages.length} msgs, convo=${conversationId.slice(0, 8)}...`,
    );
    return messages;
  } catch (err) {
    console.error("[Memory] [FAIL] getRecentMessages:", err);
    return [];
  }
}

/**
 * Delete short-term memory for a conversation
 */
export async function clearRecentMessages(
  conversationId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(redisKey(conversationId));
    console.log(
      `[Memory] [OK] Short-term cleared: convo=${conversationId.slice(0, 8)}...`,
    );
  } catch (err) {
    console.error("[Memory] [FAIL] clearRecentMessages:", err);
  }
}

// ============================================================
//  Long-term memory (PostgreSQL): project portrait
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

/**
 * Read project long-term memory from project_memories table
 */
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

/**
 * Update/Create project long-term memory
 */
export async function upsertProjectMemory(
  prisma: PrismaClientType,
  projectId: string,
  updates: Partial<ProjectPortrait>,
): Promise<void> {
  try {
    const existing = await prisma.projectMemory.findUnique({
      where: { projectId },
    });

    const portrait: ProjectPortrait = existing
      ? { ...DEFAULT_PORTRAIT, ...(existing.portrait as Record<string, unknown>) }
      : { ...DEFAULT_PORTRAIT };

    // Merge updates
    if (updates.industry !== undefined) portrait.industry = updates.industry;
    if (updates.targetUsers !== undefined)
      portrait.targetUsers = updates.targetUsers;
    if (updates.businessModel !== undefined)
      portrait.businessModel = updates.businessModel;
    if (updates.summary !== undefined) portrait.summary = updates.summary;

    // Insights: deduplicate and append
    if (updates.keyInsights?.length) {
      const existingInsights = new Set(portrait.keyInsights);
      for (const insight of updates.keyInsights) {
        existingInsights.add(insight);
      }
      portrait.keyInsights = Array.from(existingInsights);
    }

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

/**
 * Format project portrait as a system prompt fragment
 */
export function formatPortraitAsPrompt(portrait: ProjectPortrait): string {
  const lines: string[] = [];

  if (portrait.industry) {
    lines.push("Industry: " + portrait.industry);
  }
  if (portrait.targetUsers) {
    lines.push("Target Users: " + portrait.targetUsers);
  }
  if (portrait.businessModel) {
    lines.push("Business Model: " + portrait.businessModel);
  }

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

/**
 * Format short-term messages as a system prompt fragment
 */
export function formatRecentAsPrompt(messages: ShortTermMessage[]): string {
  if (messages.length === 0) return "";
  return messages
    .map(
      (m) =>
        (m.role === "user" ? "User" : "AI") + ": " + m.content,
    )
    .join("\n");
}
