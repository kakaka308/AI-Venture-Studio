import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextResponse } from "next/server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 获取项目列表
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

// 创建新项目
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, industry, targetAudience } = body;

  if (!name) {
    return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      industry,
      targetAudience,
      userId: session.user.id,
    },
  });

  return NextResponse.json(project);
}