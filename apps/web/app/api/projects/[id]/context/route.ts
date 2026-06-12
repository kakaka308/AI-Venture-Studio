import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 获取项目上下文
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: { context: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...project.context,
    projectName: project.name,
    projectDescription: project.description,
    projectIndustry: project.industry,
    projectTargetAudience: project.targetAudience,
  });
}

// 创建或更新项目上下文
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // upsert: 存在则更新，不存在则创建
  const context = await prisma.projectContext.upsert({
    where: { projectId: id },
    update: {
      industry: body.industry,
      targetAudience: body.targetAudience,
      problem: body.problem,
      valueProposition: body.valueProposition,
      competitors: body.competitors,
      stage: body.stage,
    },
    create: {
      projectId: id,
      industry: body.industry,
      targetAudience: body.targetAudience,
      problem: body.problem,
      valueProposition: body.valueProposition,
      competitors: body.competitors,
      stage: body.stage || "idea",
    },
  });

  return NextResponse.json(context);
}
