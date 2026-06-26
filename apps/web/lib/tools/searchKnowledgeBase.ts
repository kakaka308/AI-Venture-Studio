import { tool } from 'ai';
import { z } from 'zod';
import type { PrismaClient } from '@ai-venture/db';
import { searchSimilarChunks } from '@/lib/rag/chunkAndEmbed';

// -------------------------------------------------------------------------------------------
//  searchKnowledgeBase - 让 Agent 搜索知识库获取外部信息
//  支持：全文搜索 + 向量搜索（混合搜索）
//  返回：包含文档来源引用，Agent 可在回答中引用真实资料
// -------------------------------------------------------------------------------------------

interface SearchResult {
  id: string;
  title?: string;
  content: string;
  category?: string;
  tags?: string[];
  source?: string;
  relevance: number;
  searchType: 'fulltext' | 'vector';
  // 文档来源引用
  documentId?: string;
  fileName?: string;
  fileType?: string;
  chunkIndex?: number;
  projectId?: string;
  createdAt?: Date;
}

export const searchKnowledgeBase = (prisma: PrismaClient) =>
  tool({
    description: `
搜索项目知识库或全局知识库，获取创业相关的知识、市场数据、竞品信息、行业趋势等。
支持两种搜索模式：
1. 全文搜索：基于关键词匹配，适合精确查找
2. 向量搜索：基于语义相似度，适合概念性查询

当用户询问需要外部数据或知识的问题时（如市场规模、行业趋势、竞品信息等），调用此工具搜索知识库。
返回结果包含文档来源引用，可在回答中标注引用来源。
    `.trim(),

    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('搜索查询关键词或问题，如"2024年咖啡市场规模""AI 教育行业趋势""竞品分析"'),

      projectId: z
        .string()
        .optional()
        .describe('可选：限定搜索范围为指定项目。不填则搜索全局知识库'),

      category: z
        .enum([
          'market_data',
          'competitor_info',
          'industry_trend',
          'startup_knowledge',
          'other',
        ])
        .optional()
        .describe(
          '可选：按分类筛选。market_data=市场数据, competitor_info=竞品信息, industry_trend=行业趋势, startup_knowledge=创业知识, other=其他',
        ),

      limit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe('返回结果数量上限，默认为 8，最大 20'),

      searchMode: z
        .enum(['fulltext', 'vector', 'hybrid'])
        .optional()
        .describe('搜索模式：fulltext=仅全文搜索, vector=仅向量搜索, hybrid=混合搜索(默认)'),
    }),

    execute: async ({ query, projectId, category, limit = 8, searchMode = 'hybrid' }) => {
      console.log(
        `[Tool:searchKnowledgeBase] 搜索: "${query}" | 模式: ${searchMode}${projectId ? ` (项目: ${projectId})` : ' (全局)'}`,
      );

      try {
        let results: SearchResult[] = [];

        // 根据搜索模式执行相应的搜索
        if (searchMode === 'fulltext' || searchMode === 'hybrid') {
          const fulltextResults = await performFulltextSearch(prisma, {
            query,
            projectId,
            category,
            limit: searchMode === 'hybrid' ? Math.ceil(limit / 2) : limit,
          });
          results.push(...fulltextResults);
        }

        if (searchMode === 'vector' || searchMode === 'hybrid') {
          const vectorResults = await performVectorSearch({
            query,
            projectId,
            limit: searchMode === 'hybrid' ? Math.ceil(limit / 2) : limit,
          });
          results.push(...vectorResults);
        }

        // 去重（基于 content 的相似度）
        results = deduplicateResults(results);

        // 按相关性排序
        results.sort((a, b) => b.relevance - a.relevance);

        // 限制返回数量
        results = results.slice(0, limit);

        console.log(
          `[Tool:searchKnowledgeBase] 找到 ${results.length} 条结果`,
        );

        if (results.length === 0) {
          return {
            success: true,
            query,
            results: [],
            total: 0,
            message: `未找到与"${query}"相关的知识条目。知识库中可能还没有收录相关信息。`,
            suggestion: '建议：可以尝试更换关键词，或者上传相关文档到知识库。',
          };
        }

        // 格式化结果，包含来源引用
        const formatted = results.map((r) => ({
          id: r.id,
          title: r.title || '',
          content: r.content,
          category: r.category || '未分类',
          tags: r.tags || [],
          source: r.source || null,
          relevance: Math.round(r.relevance * 100) / 100,
          searchType: r.searchType,
          // 文档来源引用信息
          reference: {
            documentId: r.documentId || null,
            fileName: r.fileName || null,
            fileType: r.fileType || null,
            chunkIndex: r.chunkIndex ?? null,
            projectId: r.projectId || null,
            createdAt: r.createdAt || null,
          },
        }));

        return {
          success: true,
          query,
          results: formatted,
          total: results.length,
          message: `找到 ${results.length} 条与"${query}"相关的知识条目`,
          // 使用提示：指导 Agent 如何在回答中引用来源
          usage: {
            citationGuide: '请在回答中引用来源，格式：[来源: 文件名]。例如：根据《2024年咖啡市场报告》显示...',
            hasVectorResults: results.some(r => r.searchType === 'vector'),
            hasFulltextResults: results.some(r => r.searchType === 'fulltext'),
          },
        };
      } catch (error) {
        console.error('[Tool:searchKnowledgeBase] 搜索失败:', error);
        return {
          success: false,
          query,
          error:
            error instanceof Error ? error.message : '搜索知识库时发生未知错误',
        };
      }
    },
  });

// ---------------------------------------------------------------------------
// 全文搜索实现
// ---------------------------------------------------------------------------
async function performFulltextSearch(
  prisma: PrismaClient,
  options: {
    query: string;
    projectId?: string;
    category?: string;
    limit: number;
  }
): Promise<SearchResult[]> {
  const { query, projectId, category, limit } = options;

  try {
    // 尝试使用 PostgreSQL 全文搜索
    const searchQuery = `
      SELECT 
        ke.id,
        ke.title,
        ke.content,
        ke.category,
        ke.tags,
        ke.source,
        ke.project_id as "projectId",
        ke.created_at as "createdAt",
        ts_rank(
          to_tsvector('simple', coalesce(ke.title, '') || ' ' || coalesce(ke.content, '')),
          plainto_tsquery('simple', $1)
        ) AS rank
      FROM knowledge_entries ke
      WHERE 
        (
          to_tsvector('simple', coalesce(ke.title, '') || ' ' || coalesce(ke.content, ''))
          @@ plainto_tsquery('simple', $1)
          OR ke.title ILIKE '%' || $1 || '%'
          OR ke.content ILIKE '%' || $1 || '%'
        )
        ${projectId ? `AND (ke.project_id = '${projectId}' OR ke.project_id IS NULL)` : ''}
        ${category ? `AND ke.category = '${category}'` : ''}
      ORDER BY rank DESC, ke.updated_at DESC
      LIMIT ${Math.min(limit, 20)}
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await prisma.$queryRawUnsafe<any[]>(searchQuery, query);

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content.length > 800 ? r.content.substring(0, 800) + '...' : r.content,
      category: r.category,
      tags: Array.isArray(r.tags) ? r.tags : [],
      source: r.source,
      relevance: parseFloat(r.rank) || 0.5,
      searchType: 'fulltext' as const,
      projectId: r.projectId,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.warn('[FulltextSearch] 全文搜索失败，返回空结果:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 向量搜索实现
// ---------------------------------------------------------------------------
async function performVectorSearch(options: {
  query: string;
  projectId?: string;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, projectId, limit } = options;

  try {
    // 调用向量搜索函数
    const vectorResults = await searchSimilarChunks(query, {
      projectId,
      limit,
      minSimilarity: 0.5, // 降低阈值以获取更多结果
    });

    // 获取文档信息以补充来源引用
    return vectorResults.map((result) => ({
      id: result.chunkId,
      content: result.content.length > 800 ? result.content.substring(0, 800) + '...' : result.content,
      relevance: result.similarity,
      searchType: 'vector' as const,
      // 文档来源引用
      documentId: result.documentId,
      fileName: result.fileName,
      chunkIndex: result.chunkIndex,
      projectId: projectId,
      // 额外信息
      title: `[文档片段] ${result.fileName}`,
      category: 'document_chunk',
      tags: [],
      source: `knowledge_documents/${result.documentId}`,
    }));
  } catch (error) {
    console.warn('[VectorSearch] 向量搜索失败，返回空结果:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 结果去重
// ---------------------------------------------------------------------------
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduplicated: SearchResult[] = [];

  for (const result of results) {
    // 使用 id 作为去重键
    const key = result.id;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(result);
    }
  }

  return deduplicated;
}
