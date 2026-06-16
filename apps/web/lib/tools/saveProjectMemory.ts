import { tool } from 'ai';
import { z } from 'zod';
import type { PrismaClient } from '@ai-venture/db';
import { upsertProjectMemory } from '@/lib/memory';
// -------------------------------------------------------------------------------------------
//  saveProjectMemory - 让 Agent 写入/更新项目的长期记忆
//  使用场景：对话中 Agent 学到了新信息，需要持久化存储（如"我记住了你的项目主要针对大学生群体"）
// -------------------------------------------------------------------------------------------

export const saveProjectMemory = (prisma: PrismaClient) =>
  tool({
    description:
      '将你在对话中学到的项目关键信息保存到长期记忆中。当用户透露新的项目信息（如行业、目标用户、商业模式、关键洞察、项目摘要等）且值得持久记住时，调用此工具存储这些信息。',

    inputSchema: z.object({
      projectId: z
        .string()
        .describe('要记录信息的创业项目的唯一标识符 (UUID)'),

      industry: z
        .string()
        .optional()
        .describe(
          '项目所属的行业/赛道，如"在线教育""医疗健康""企业SaaS"等。仅在获得新的行业信息时填写。',
        ),

      targetUsers: z
        .string()
        .optional()
        .describe(
          '项目的目标用户群体，如"大学生""中小企业主""健身爱好者"等。仅在获得新的目标用户信息时填写。',
        ),

      businessModel: z
        .string()
        .optional()
        .describe(
          '项目的商业模式/盈利方式，如"订阅制""广告变现""平台抽佣"等。仅在获得新的商业模式信息时填写。',
        ),

      keyInsights: z
        .array(z.string())
        .optional()
        .describe(
          '从对话中提炼出的关键洞察和重要发现，如"用户对价格敏感""竞争者主要集中在北上广"等。当对话揭示了新的有价值的洞察时追加。',
        ),

      summary: z
        .string()
        .optional()
        .describe(
          '对项目整体的简明摘要描述。当对项目有了更完整的理解后，可以更新此摘要。',
        ),
    }),

    execute: async ({
      projectId,
      industry,
      targetUsers,
      businessModel,
      keyInsights,
      summary,
    }) => {
      console.log(
        `[Tool:saveProjectMemory] 开始保存项目 ${projectId} 的长期记忆`,
      );

      // 构建增量更新对象（只传有值的字段）
      const updates: Record<string, unknown> = {};
      if (industry !== undefined) updates.industry = industry;
      if (targetUsers !== undefined) updates.targetUsers = targetUsers;
      if (businessModel !== undefined) updates.businessModel = businessModel;
      if (keyInsights !== undefined) updates.keyInsights = keyInsights;
      if (summary !== undefined) updates.summary = summary;

      // 检查是否有实际更新内容
      if (Object.keys(updates).length === 0) {
        console.log('[Tool:saveProjectMemory] 无更新内容，跳过');
        return {
          success: true,
          message: '没有需要更新的信息',
          updated: {},
        };
      }

      try {
        await upsertProjectMemory(prisma, projectId, updates);

        const savedFields = Object.keys(updates);
        console.log(
          `[Tool:saveProjectMemory] 保存成功，更新字段: ${savedFields.join(', ')}`,
        );

        return {
          success: true,
          message: `已保存项目记忆，更新了以下字段: ${savedFields.join('、')}`,
          updated: savedFields,
        };
      } catch (error) {
        console.error('[Tool:saveProjectMemory] 保存失败:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : '保存项目记忆时发生未知错误',
        };
      }
    },
  });
