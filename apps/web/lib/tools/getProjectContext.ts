import { tool } from 'ai';
import { z } from 'zod';
import type { PrismaClient } from '@ai-venture/db';
// -------------------------------------------------------------------------------------------
//  获取项目的完整上下文信息（项目名称、描述、行业、目标用户、问题、价值主张、竞争对手、阶段等）
// -------------------------------------------------------------------------------------------

export const getProjectContext = (prisma: PrismaClient) =>
  tool({
    description:
      '获取指定创业项目的完整上下文信息，包括项目名称、描述、行业、目标用户、解决的问题、价值主张、竞争对手、项目阶段等。当用户询问项目情况或你需要回顾项目背景时，调用此工具。',
    
    inputSchema: z.object({
      projectId: z.string().describe('要查询的创业项目的唯一标识符 (UUID)'),
    }),

    execute: async ({ projectId }) => {
      console.log(`[Tool:getProjectContext] 开始查询项目 ${projectId}`);

      try {
        // 查询项目基本信息 + 关联的 ProjectContext
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            context: true, // 关联查询 ProjectContext
          },
        });

        if (!project) {
          console.log(`[Tool:getProjectContext] 项目不存在: ${projectId}`);
          return {
            success: false,
            error: `项目 ${projectId} 不存在`,
          };
        }

        // 组装返回数据
        const projectContext = {
          id: project.id,
          name: project.name,
          description: project.description,
          industry: project.industry,
          targetAudience: project.targetAudience,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),

          // ProjectContext 字段
          problem: project.context?.problem || null,
          valueProposition: project.context?.valueProposition || null,
          competitors: project.context?.competitors || null,
          stage: project.context?.stage || 'idea',
        };

        console.log(`[Tool:getProjectContext] 查询成功: ${project.name}`);
        return {
          success: true,
          project: projectContext,
        };
      } catch (error) {
        console.error('[Tool:getProjectContext] 查询失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        };
      }
    },
  });
