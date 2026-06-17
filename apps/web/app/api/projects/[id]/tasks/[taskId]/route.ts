import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// PATCH /api/projects/[id]/tasks/[taskId] - 更新任务
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId, taskId } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const body = await req.json();
  const { status, priority, title, description, dueDate, assignedTo } = body as {
    status?: string;
    priority?: string;
    title?: string;
    description?: string;
    dueDate?: string;
    assignedTo?: string;
  };

  const updated = await prisma.task.update({
    where: { id: taskId, projectId },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(assignedTo !== undefined ? { assignedTo } : {}),
    },
  });

  return Response.json(updated);
}

// DELETE /api/projects/[id]/tasks/[taskId] - 删除任务
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId, taskId } = await params;

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  await prisma.task.delete({
    where: { id: taskId, projectId },
  });

  return Response.json({ success: true });
}
