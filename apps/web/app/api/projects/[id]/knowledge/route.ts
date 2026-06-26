import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 获取项目知识库文件列表
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where: { projectId: id },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      chunksCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
}

// 删除知识库文件
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "缺少 documentId 参数" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const document = await prisma.knowledgeDocument.findFirst({
    where: { id: documentId, projectId: id },
  });
  if (!document) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  // 先删除关联的 chunks，再删除文档
  await prisma.knowledgeChunk.deleteMany({
    where: { documentId },
  });
  await prisma.knowledgeDocument.delete({
    where: { id: documentId },
  });

  return NextResponse.json({ success: true });
}
