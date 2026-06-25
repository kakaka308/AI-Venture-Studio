import { PrismaClient } from "../db";
import { PrismaPg } from "@prisma/adapter-pg";
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  console.log("开始初始化数据");

  try {
    // 启用 pgvector 扩展
    await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
    // knowledge_chunks 表添加向量列
    const hasEmbedding = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1 FROM infomation_schema.colums
          WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
        )
    `)
    // embedding列不存在
    if (!hasEmbedding[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE 'knowledge_chunks'  
        ADD COLUMN 'embedding' vector(1536)
      `)
    }

    // 向量索引
    const hasVectorIdx = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'knowledge_chunks_embedding_idx'
      )
    `);
    // 如果索引不存在
    if (!hasVectorIdx[0]?.exists) {
      console.log("  • 创建 IVFFlat 向量索引（这可能需要几分钟）...");
      await prisma.$executeRawUnsafe(`
        CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks"
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);
      console.log("  ✓ 向量索引已创建\n");
    } 
  } catch(err) {
    console.log("初始化失败", err);
    process.exit(1);
  } finally {
    // 断开数据库连接防止泄露
    await prisma.$disconnect();
  }
}

main();