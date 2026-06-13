import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest, NextResponse } from "next/server";
import {
  getProjectMemory,
  upsertProjectMemory,
  type ProjectPortrait,
} from "@/lib/memory";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * GET /api/projects/[id]/memory
 * 获取项目长期记忆（画像）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const memory = await getProjectMemory(prisma, projectId);

  return NextResponse.json({
    portrait: memory?.portrait ?? {
      industry: "",
      targetUsers: "",
      businessModel: "",
      keyInsights: [],
      summary: "",
    },
    lastExtractedAt: memory?.lastExtractedAt ?? null,
  });
}

/**
 * PATCH /api/projects/[id]/memory
 * 更新项目长期记忆（画像）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await req.json()) as Partial<ProjectPortrait>;
  await upsertProjectMemory(prisma, projectId, body);

  const updated = await getProjectMemory(prisma, projectId);
  return NextResponse.json({
    portrait: updated?.portrait,
    lastExtractedAt: updated?.lastExtractedAt,
  });
}
