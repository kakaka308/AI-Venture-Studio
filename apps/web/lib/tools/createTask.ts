import { tool } from 'ai';
import { z } from 'zod';
import type { PrismaClient } from '@ai-venture/db';
// -------------------------------------------------------------------------------------------
//  createTask - 让 Agent 创建任务到项目管理系统
//  使用场景：用户说"帮我创建一个任务：完成市场调研"，Agent 调用此工具创建任务
// -------------------------------------------------------------------------------------------

export const createTask = (prisma: PrismaClient) =>
  tool({
    description:
      '在项目中创建一个新任务。当用户要求你创建、添加或记录一个待办任务时调用此工具。任务可以包含标题、描述、优先级、状态和截止日期。',

    inputSchema: z.object({
      projectId: z
        .string()
        .describe('任务所属的创业项目的唯一标识符 (UUID)'),

      title: z
        .string()
        .min(1)
        .max(200)
        .describe('任务的标题，简洁明了地描述要做什么，如"完成市场调研""设计产品原型""编写商业计划书"'),

      description: z
        .string()
        .optional()
        .describe('任务的详细描述，包括具体要求、预期成果、注意事项等'),

      priority: z
        .enum(['low', 'medium', 'high', 'urgent'])
        .optional()
        .describe('任务优先级：low（低）、medium（中）、high（高）、urgent（紧急）。不填写默认为 medium'),

      status: z
        .enum(['todo', 'in_progress', 'done', 'cancelled'])
        .optional()
        .describe('任务状态：todo（待开始）、in_progress（进行中）、done（已完成）、cancelled（已取消）。不填写默认为 todo'),

      dueDate: z
        .string()
        .optional()
        .describe('任务截止日期，格式为 ISO 8601 日期字符串，如"2026-07-01"。仅当用户明确提到截止时间时填写'),

      assignedTo: z
        .string()
        .optional()
        .describe('任务负责人，可以是用户姓名或用户名。仅当用户指定了负责人时填写'),
    }),

    execute: async ({
      projectId,
      title,
      description,
      priority,
      status,
      dueDate,
      assignedTo,
    }) => {
      console.log(
        `[Tool:createTask] 开始创建任务: "${title}" (项目: ${projectId})`,
      );

      try {
        // 验证项目是否存在
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true },
        });

        if (!project) {
          console.log(`[Tool:createTask] 项目不存在: ${projectId}`);
          return {
            success: false,
            error: `项目 ${projectId} 不存在，无法创建任务`,
          };
        }

        // 防重复：检查是否已存在同名未完成任务
        const existingTask = await prisma.task.findFirst({
          where: {
            projectId,
            title,
            status: { in: ["todo", "in_progress"] },
          },
        });
        if (existingTask) {
          console.log(`[Tool:createTask] 任务已存在，跳过创建: "${title}" (id=${existingTask.id})`);
          return {
            success: true,
            message: `任务「${title}」已存在，无需重复创建`,
            task: {
              id: existingTask.id,
              title: existingTask.title,
              description: existingTask.description,
              priority: existingTask.priority,
              status: existingTask.status,
              dueDate: existingTask.dueDate?.toISOString().split("T")[0] || null,
              assignedTo: existingTask.assignedTo,
            },
          };
        }

        // 解析截止日期
        const parsedDueDate = dueDate ? new Date(dueDate) : null;
        if (dueDate && isNaN(parsedDueDate!.getTime())) {
          return {
            success: false,
            error: `无效的截止日期格式: "${dueDate}"，请使用 ISO 8601 格式（如 "2026-07-01"）`,
          };
        }

        // 创建任务
        const task = await prisma.task.create({
          data: {
            projectId,
            title,
            description: description || null,
            priority: priority || 'medium',
            status: status || 'todo',
            dueDate: parsedDueDate,
            assignedTo: assignedTo || null,
          },
        });

        console.log(
          `[Tool:createTask] 创建成功: id=${task.id}, title="${task.title}"`,
        );

        const priorityLabel = {
          low: '低优先级',
          medium: '中优先级',
          high: '高优先级',
          urgent: '紧急',
        }[task.priority];

        const statusLabel = {
          todo: '待开始',
          in_progress: '进行中',
          done: '已完成',
          cancelled: '已取消',
        }[task.status];

        return {
          success: true,
          message: `已创建任务「${task.title}」`,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            priorityLabel,
            status: task.status,
            statusLabel,
            dueDate: task.dueDate?.toISOString().split('T')[0] || null,
            assignedTo: task.assignedTo,
          },
        };
      } catch (error) {
        console.error('[Tool:createTask] 创建失败:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : '创建任务时发生未知错误',
        };
      }
    },
  });
