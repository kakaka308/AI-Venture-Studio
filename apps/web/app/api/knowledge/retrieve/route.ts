import { auth } from "@/auth";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextResponse } from "next/server";
import { searchSimilarChunks } from "@/lib/rag/chunkAndEmbed";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export async function POST(request: Request) {
  try {
    // 1. 身份验证
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 2. 解析请求参数
    const body = await request.json();
    const { query, projectId, limit = 5, minSimilarity = 0.6 } = body;

    // 3. 参数验证
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "缺少查询参数 query" },
        { status: 400 }
      );
    }

    if (query.trim().length === 0) {
      return NextResponse.json(
        { error: "查询参数不能为空" },
        { status: 400 }
      );
    }

    // 4. 如果指定了 projectId，验证权限
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.userId !== session.user.id) {
        return NextResponse.json(
          { error: "项目不存在或无权限" },
          { status: 403 }
        );
      }
    }

    // 5. 调用向量检索函数
    const results = await searchSimilarChunks(query.trim(), {
      projectId,
      limit: Math.min(limit, 20), // 限制最大返回 20 条
      minSimilarity,
    });

    // 6. 返回结果
    return NextResponse.json({
      success: true,
      query: query.trim(),
      resultsCount: results.length,
      results: results.map(result => ({
        chunkId: result.chunkId,
        documentId: result.documentId,
        fileName: result.fileName,
        content: result.content,
        chunkIndex: result.chunkIndex,
        similarity: parseFloat(result.similarity.toFixed(4)), // 保留 4 位小数
      })),
    });

  } catch (error) {
    console.error("[Retrieve] 向量检索失败:", error);
    
    return NextResponse.json(
      { 
        error: "向量检索失败",
        details: error instanceof Error ? error.message : "未知错误"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // 1. 身份验证
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 2. 从 URL 参数获取查询条件
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "5");
    const minSimilarity = parseFloat(searchParams.get("minSimilarity") || "0.6");

    // 3. 参数验证
    if (!query) {
      return NextResponse.json(
        { error: "缺少查询参数 query" },
        { status: 400 }
      );
    }

    // 4. 如果指定了 projectId，验证权限
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.userId !== session.user.id) {
        return NextResponse.json(
          { error: "项目不存在或无权限" },
          { status: 403 }
        );
      }
    }

    // 5. 调用向量检索函数
    const results = await searchSimilarChunks(query.trim(), {
      projectId: projectId || undefined,
      limit: Math.min(limit, 20),
      minSimilarity,
    });

    // 6. 返回结果
    return NextResponse.json({
      success: true,
      query: query.trim(),
      resultsCount: results.length,
      results: results.map(result => ({
        chunkId: result.chunkId,
        documentId: result.documentId,
        fileName: result.fileName,
        content: result.content,
        chunkIndex: result.chunkIndex,
        similarity: parseFloat(result.similarity.toFixed(4)),
      })),
    });

  } catch (error) {
    console.error("[Retrieve] 向量检索失败:", error);
    
    return NextResponse.json(
      { 
        error: "向量检索失败",
        details: error instanceof Error ? error.message : "未知错误"
      },
      { status: 500 }
    );
  }
}
