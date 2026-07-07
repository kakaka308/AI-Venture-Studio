import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { upsertProjectMemory, type ProjectPortrait } from '@/lib/memory';
import type { PrismaClient } from '@ai-venture/db';

const qwen = createOpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY,
});

/**
 * 从对话文本中强制抽取结构化记忆，绕过 LLM 自觉调用工具的不稳定性。
 * 在 chat onFinish / workflow 完成后异步调用。
 */
export async function extractAndSaveMemory(
  prisma: PrismaClient,
  projectId: string,
  text: string,
  source: 'chat' | 'workflow' = 'chat',
): Promise<void> {
  if (!text || text.length < 50) {
    console.log(`[extractMemory] 文本太短，跳过抽取 (source=${source})`);
    return;
  }

  // 截断过长文本
  const truncated = text.length > 8000 ? text.slice(0, 8000) + '...' : text;

  try {
    const result = await generateText({
      model: qwen('qwen3.6-flash'),
      system: `你是一个信息抽取助手。你的任务是从文本中抽取创业项目的结构化信息。
请以 JSON 格式输出，只输出以下字段（只输出有信息的字段，没有的不要输出空值）：
{
  "industry": "行业/赛道",
  "targetUsers": "目标用户群体",
  "businessModel": "商业模式/盈利方式",
  "keyInsights": ["关键洞察1", "关键洞察2"],
  "summary": "对项目的简明摘要（2-3句话）"
}

重要规则：
1. 只输出有实质信息且能在原文中找到依据的字段
2. 不要编造信息
3. 只输出纯 JSON，不要包含 markdown 代码块标记或其他文字`,
      prompt: `请从以下文本中抽取项目的结构化信息：\n\n${truncated}`,
      maxOutputTokens: 1500,
      temperature: 0.2,
    });

    const jsonStr = result.text.trim();
    // 提取 JSON（可能被 ```json ... ``` 包裹）
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log('[extractMemory] 无法解析 JSON 输出:', jsonStr.slice(0, 200));
      return;
    }

    const parsed = JSON.parse(match[0]);
    const updates: Partial<ProjectPortrait> = {};

    if (parsed.industry && typeof parsed.industry === 'string') updates.industry = parsed.industry;
    if (parsed.targetUsers && typeof parsed.targetUsers === 'string') updates.targetUsers = parsed.targetUsers;
    if (parsed.businessModel && typeof parsed.businessModel === 'string')
      updates.businessModel = parsed.businessModel;
    if (parsed.keyInsights && Array.isArray(parsed.keyInsights))
      updates.keyInsights = parsed.keyInsights.filter(
        (i: unknown) => typeof i === 'string' && i.length > 0,
      );
    if (parsed.summary && typeof parsed.summary === 'string') updates.summary = parsed.summary;

    if (Object.keys(updates).length === 0) {
      console.log('[extractMemory] 未抽取到有效字段，跳过保存');
      return;
    }

    await upsertProjectMemory(prisma, projectId, updates);
    console.log(
      `[extractMemory] ✓ 已从 ${source} 中抽取并保存记忆: ${Object.keys(updates).join(', ')}`,
    );
  } catch (err) {
    console.error(`[extractMemory] 抽取失败 (source=${source}):`, err);
  }
}

/**
 * 从 workflow Multi-Agent 分析结果中抽取信息，回写到 ProjectContext（情景文件）。
 * 让 workflow 产出的分析结果自动更新项目的问题、价值主张、竞品、阶段等。
 */
export async function extractAndUpdateContext(
  prisma: PrismaClient,
  projectId: string,
  text: string,
): Promise<void> {
  if (!text || text.length < 80) return;

  const truncated = text.length > 10000 ? text.slice(0, 10000) + '...' : text;

  try {
    const result = await generateText({
      model: qwen('qwen3.6-flash'),
      system: `你是一个项目信息抽取助手。请从 Multi-Agent 分析报告中提取项目情景信息。
输出纯 JSON：
{
  "problem": "项目解决的核心问题",
  "valueProposition": "价值主张/独特卖点",
  "competitors": "已知的竞争对手",
  "stage": "项目阶段（idea/validation/prototype/mvp）"
}
只输出有实质内容的字段，不要编造。只输出 JSON。`,
      prompt: `请从以下分析报告中抽取项目情景信息：\n\n${truncated}`,
      maxOutputTokens: 1000,
      temperature: 0.2,
    });

    const jsonStr = result.text.trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log('[extractContext] 无法解析 JSON:', jsonStr.slice(0, 200));
      return;
    }

    const parsed = JSON.parse(match[0]);
    const data: Record<string, string> = {};
    if (parsed.problem && typeof parsed.problem === 'string') data.problem = parsed.problem;
    if (parsed.valueProposition && typeof parsed.valueProposition === 'string')
      data.valueProposition = parsed.valueProposition;
    if (parsed.competitors && typeof parsed.competitors === 'string')
      data.competitors = parsed.competitors;
    if (
      parsed.stage &&
      typeof parsed.stage === 'string' &&
      ['idea', 'validation', 'prototype', 'mvp'].includes(parsed.stage)
    )
      data.stage = parsed.stage;

    if (Object.keys(data).length === 0) {
      console.log('[extractContext] 未抽取到有效字段，跳过');
      return;
    }

    // 更新或创建 ProjectContext
    await prisma.projectContext.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
    });

    // 同时更新 Project 主表的 industry 字段（如果抽取到了行业信息但主表没填）
    if (parsed.industry && typeof parsed.industry === 'string') {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project && !project.industry) {
        await prisma.project.update({
          where: { id: projectId },
          data: { industry: parsed.industry },
        });
      }
    }

    console.log(
      `[extractContext] ✓ 已从 workflow 分析中更新情景文件: ${Object.keys(data).join(', ')}`,
    );
  } catch (err) {
    console.error('[extractContext] 更新失败:', err);
  }
}
