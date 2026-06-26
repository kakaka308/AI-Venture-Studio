import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "bge-m3";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 向量相似度搜索结果接口
interface SimilaritySearchResult {
  chunkId: string;
  documentId: string;
  fileName: string;
  content: string;
  chunkIndex: number;
  similarity: string;
}

// 文本分块
export function splitTextIntoChunks(
  text: string,
  options: {
    maxChunkSize?: number;
    minChunkSize?: number; 
    overlap?: number;
  } = {}
): string[] {
  const {
    maxChunkSize = 800,
    minChunkSize = 100,
    overlap = 150,
  } = options;

  const cleanedText = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const paragraphs = cleanedText.split(/\n\n+/);
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    if (trimmedParagraph.length > maxChunkSize) {
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk.trim());
        const overlapText = currentChunk.length > overlap ? currentChunk.slice(-overlap) : currentChunk;
        currentChunk = overlapText;
      }

      const sentenceChunks = splitLongParagraph(trimmedParagraph, maxChunkSize);
      for (const sentenceChunk of sentenceChunks) {
        if (sentenceChunk.length >= minChunkSize) {
          chunks.push(sentenceChunk.trim());
        }
      }
      currentChunk = "";
      continue;
    }

    if (currentChunk.length + trimmedParagraph.length + 2 > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.length > overlap ? currentChunk.slice(-overlap) : currentChunk;
      currentChunk = overlapText + "\n\n" + trimmedParagraph;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += "\n\n" + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
      }
    }
  }

  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
    chunks[chunks.length - 1] += "\n\n" + currentChunk.trim();
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// 按句子分割过长的段落
function splitLongParagraph(text: string, maxSize: number): string[] {
  // 按句子分割（中英文句号、问号、感叹号）
  const sentenceEndings = /(?<=[。！？.!?\s])\s+/;
  const sentences = text.split(sentenceEndings).filter(s => s.trim().length > 0);
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if (currentChunk.length + trimmedSentence.length + 1 <= maxSize) {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      if (trimmedSentence.length > maxSize) {
        const forcedChunks = forceSplitByChars(trimmedSentence, maxSize);
        chunks.push(...forcedChunks);
        currentChunk = "";
      } else {
        currentChunk = trimmedSentence;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

// 按字符强制分割
function forceSplitByChars(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxSize) {
    chunks.push(text.slice(i, i + maxSize));
  }
  return chunks;
}

// Embedding 生成bge-m3
async function generateEmbeddingOllama(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API 错误 ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Ollama 返回的 embedding 格式错误");
  }

  return data.embedding as number[];
}

// 批量生成 Embeddings
async function generateEmbeddingsBatch(
  texts: string[], 
  concurrency: number = 3
): Promise<number[][]> {
  const results: number[][] = [];
  
  // 分批处理，避免并发过高
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(text => generateEmbeddingOllama(text))
    );
    
    results.push(...batchResults);
    
    // 打印进度
    console.log(`[Embedding] 进度: ${Math.min(i + concurrency, texts.length)}/${texts.length}`);
  }
  
  return results;
}

// Embedding 生成函数

export async function generateEmbedding(text: string): Promise<number[]> {
  return await generateEmbeddingOllama(text);
}

// 处理文档：分块 + Embedding + 存储
export async function processDocumentForRAG(
  documentId: string,
  content: string
): Promise<{
  chunksCount: number;
  status: "success" | "error";
  error?: string;
}> {
  try {
    console.log(`[RAG] 开始处理文档 ${documentId}...`);
    
    // 文本分块
    const chunks = splitTextIntoChunks(content, {
      maxChunkSize: 800,
      minChunkSize: 100,
      overlap: 150,
    });
    
    console.log(`[RAG] 分块完成: ${chunks.length} 个块`);
    
    if (chunks.length === 0) {
      return {
        chunksCount: 0,
        status: "error",
        error: "文档内容为空或无法分块",
      };
    }

    // 生成 Embeddings
    console.log(`[RAG] 开始生成 Embedding...`);
    const embeddings = await generateEmbeddingsBatch(chunks, 3);
    
    console.log(`[RAG] Embedding 生成完成`);

    // 先删除旧的 chunks
    await prisma.knowledgeChunk.deleteMany({
      where: { documentId },
    });

    // 校验分块与 embedding 数量一致
    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embeddings 数量与分块数量不一致: embeddings=${embeddings.length}, chunks=${chunks.length}`
      );
    }

    // 存储到 knowledge_chunks 表
    console.log(`[RAG] 开始存储到数据库...`);
    
    const chunkRecords = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),  // 生成 ID
      documentId: documentId,
      content: chunk,
      chunkIndex: index,
      embedding: embeddings[index],
      createdAt: new Date(),
    }));

    // 批量插入
    await prisma.knowledgeChunk.createMany({
      data: chunkRecords.map(record => ({
        id: record.id,
        documentId: record.documentId,
        content: record.content,
        chunkIndex: record.chunkIndex,
        embedding: record.embedding,
        createdAt: record.createdAt,
      })),
    }); 

    // 更新文档的 chunksCount
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { 
        chunksCount: chunks.length,
        metadata: {
          ...((await prisma.knowledgeDocument.findUnique({ 
            where: { id: documentId } 
          }))?.metadata as Record<string, unknown> ?? {}),
          processedAt: new Date().toISOString(),
          embeddingModel: OLLAMA_MODEL,
        },
      },
    });

    console.log(`[RAG] 处理完成: ${chunks.length} 个块已存入数据库`);

    return {
      chunksCount: chunks.length,
      status: "success",
    };

  } catch (error) {
    console.error(`[RAG] 处理失败:`, error);
    return {
      chunksCount: 0,
      status: "error",
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

// 向量相似度搜索
export async function searchSimilarChunks(
  query: string,
  options: {
    projectId?: string;
    limit?: number;
    minSimilarity?: number;
  } = {}
): Promise<Array<{
  chunkId: string;
  documentId: string;
  fileName: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}>> {
  const { projectId, limit = 5, minSimilarity = 0.6 } = options;

  // 生成查询的 embedding
  const queryEmbedding = await generateEmbedding(query);

  // 构建 SQL 查询（使用 pgvector 的余弦距离）
  // <=> 是余弦距离算子，1 - 距离 = 相似度
  const sql = `
    SELECT 
      kc.id as "chunkId",
      kc.document_id as "documentId",
      kd.file_name as "fileName",
      kc.content,
      kc.chunk_index as "chunkIndex",
      1 - (kc.embedding <=> $1::vector) as "similarity"
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE ($2::text IS NULL OR kd.project_id = $2::text)
      AND 1 - (kc.embedding <=> $1::vector) >= $3
    ORDER BY kc.embedding <=> $1::vector
    LIMIT $4;
  `;

  // 3. 执行查询
  const result = await prisma.$queryRawUnsafe(
    sql,
    `[${queryEmbedding.join(",")}]`,
    projectId || null,
    minSimilarity,
    limit
  ) as SimilaritySearchResult[];

  return result.map(row => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    fileName: row.fileName,
    content: row.content,
    chunkIndex: row.chunkIndex,
    similarity: parseFloat(row.similarity),
  }));
}


// 工具函数：测试 Ollama 连接
export async function testOllamaConnection(): Promise<{
  success: boolean;
  message: string;
  dimensions?: number;
}> {
  try {
    const testEmbedding = await generateEmbeddingOllama("测试文本");
    
    return {
      success: true,
      message: `Ollama 连接成功，模型: ${OLLAMA_MODEL}`,
      dimensions: testEmbedding.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "连接失败",
    };
  }
}
