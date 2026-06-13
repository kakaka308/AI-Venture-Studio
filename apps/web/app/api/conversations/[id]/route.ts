import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest, NextResponse } from "next/server";
import { clearRecentMessages } from "@/lib/memory";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 获取单个对话及消息
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(conversation);
}

// 删除对话
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  await prisma.conversation.delete({ where: { id } });

  // 同步清理 Redis 短期记忆
  clearRecentMessages(id).catch((err) =>
    console.error("[Memory] 清理 Redis 失败:", err),
  );

  return NextResponse.json({ success: true });
}
