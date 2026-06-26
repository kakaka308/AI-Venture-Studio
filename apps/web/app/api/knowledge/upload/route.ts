import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextResponse } from "next/server";
// @ts-expect-error - pdf-parse v2.x ESM 入口无 default 导出，但 bundler 运行时处理 CJS interop
import pdf from "pdf-parse";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 支持的文件类型
const SUPPORTED_TYPES = {
  "application/pdf": "pdf",
  "text/markdown": "markdown",
  "text/plain": "txt",
  "text/x-markdown": "markdown",
} as const;


const MAX_FILE_SIZE = 10 * 1024 * 1024; // 最大文件大小 (10MB)

// 解析文件内容
async function parseFileContent(
  buffer: Buffer,
  fileType: string
) : Promise<string> {
  switch(fileType) {
    case "pdf" : {
      const data = await pdf(buffer);
      return data.text;
    }

    case "markdown" : 
    case "txt" :
      return buffer.toString("utf-8");

    default :
    throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

// 上传并解析知识库文件
export async function POST(request: Request) {
  try  {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "缺少projectId参数" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id : projectId },
    })
    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "项目不存在或无权限" }, { status: 403 });
    }

    const fileType = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];

    let finaFileType = fileType;
    if (!finaFileType) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") finaFileType = "pdf";
      else if (ext === "md" || ext === "markdown") finaFileType = "markdown";
      else if (ext === "txt") finaFileType = "txt";
      else return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "文件大小超过了 10MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let content: string;
    try {
      content = await parseFileContent(buffer, finaFileType);
    } catch (parseError) {
      console.error("文件解析失败:", parseError);
      return NextResponse.json({ error: "文件解析失败" },{ status: 400 });
    }

    const metadata = {
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    }

    const document = await prisma.knowledgeDocument.create({
      data: {
        fileName: file.name,
        fileType: finaFileType,
        fileSize: file.size,
        content: content,
        metadata: metadata,
        projectId: projectId,
      },
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        createdAt: document.createdAt,
        contentLength: content.length,
      },
    });

  } catch(err) {
    console.error("文件上传失败", err); 
    return NextResponse.json(
      { error: "文件上传失败" },
      { status: 500 }
    );
  }
}