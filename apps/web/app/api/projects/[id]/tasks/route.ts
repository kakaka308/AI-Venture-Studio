import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// GET /api/projects/[id]/tasks - 获取项目任务列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return Response.json(tasks);
}

// POST /api/projects/[id]/tasks - 创建任务
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const body = await req.json();
  const { title, description, priority, status, dueDate, assignedTo } = body as {
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    dueDate?: string;
    assignedTo?: string;
  };

  if (!title) {
    return new Response("Title is required", { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      priority: priority ?? "medium",
      status: status ?? "todo",
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedTo: assignedTo ?? null,
      projectId,
    },
  });

  return Response.json(task, { status: 201 });
}
