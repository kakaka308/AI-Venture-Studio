import { tool } from 'ai';
import { z } from 'zod';
import type { PrismaClient } from '@ai-venture/db';
// -------------------------------------------------------------------------------------------
//  searchKnowledgeBase - 让 Agent 搜索知识库获取外部信息
//  使用场景：用户问"2024年中国的咖啡市场规模是多少？"，Agent 调用此工具搜索最新数据
// -------------------------------------------------------------------------------------------

export const searchKnowledgeBase = (prisma: PrismaClient) =>
  tool({
    description:
      '搜索项目知识库或全局知识库，获取创业相关的知识、市场数据、竞品信息、行业趋势等。当用户询问需要外部数据或知识的问题时（如市场规模、行业趋势、竞品信息等），调用此工具搜索知识库。',

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
        .max(10)
        .optional()
        .describe('返回结果数量上限，默认为 5，最大 10'),
    }),

    execute: async ({ query, projectId, category, limit = 5 }) => {
      console.log(
        `[Tool:searchKnowledgeBase] 搜索: "${query}"${projectId ? ` (项目: ${projectId})` : ' (全局)'}`,
      );

      try {
        // 使用 PostgreSQL 全文搜索 + ILIKE 兜底
        // plainto_tsquery 将用户输入转为 tsquery；ts_rank 计算相关性评分
        const searchQuery = `
          SELECT
            id, title, content, category, tags, source,
            COALESCE(project_id, '') as "projectId",
            created_at as "createdAt",
            ts_rank(
              to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')),
              plainto_tsquery('simple', $1)
            ) AS rank
          FROM knowledge_entries
          WHERE
            (
              to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
              @@ plainto_tsquery('simple', $1)
              OR title ILIKE '%' || $1 || '%'
              OR content ILIKE '%' || $1 || '%'
            )
            ${projectId ? `AND (project_id = '${projectId}' OR project_id IS NULL)` : ''}
            ${category ? `AND category = '${category}'` : ''}
          ORDER BY rank DESC, updated_at DESC
          LIMIT ${Math.min(limit, 10)}
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await prisma.$queryRawUnsafe<any[]>(
          searchQuery,
          query,
        );

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
          };
        }

        // 格式化结果
        const formatted = results.map((r) => ({
          id: r.id,
          title: r.title,
          content:
            r.content.length > 500
              ? r.content.substring(0, 500) + '...'
              : r.content,
          category: r.category || '未分类',
          tags: Array.isArray(r.tags) ? r.tags : [],
          source: r.source || null,
          projectId: r.projectId || null,
          relevance: Math.round(r.rank * 100) / 100,
          createdAt: r.createdAt,
        }));

        return {
          success: true,
          query,
          results: formatted,
          total: results.length,
          message: `找到 ${results.length} 条与"${query}"相关的知识条目`,
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
