// ============================================================
// 上下文管理工具 — 避免 LLM prompt 超出 token 限制
// ============================================================

/** Qwen3.6-Flash 上下文窗口上限（留 20% 缓冲给输出） */
const MAX_INPUT_TOKENS = 26_000;

/** 粗略估算 token 数：中文约 1 char ≈ 1.5 tokens，英文约 1 char ≈ 0.3 tokens，取平均约 1 char ≈ 0.8 tokens */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.8);
}

interface TruncateOptions {
  /** 最大 token 数 */
  maxTokens?: number;
  /** 保留开头字符数（不截断） */
  keepHead?: number;
  /** 保留结尾字符数（不截断） */
  keepTail?: number;
}

/**
 * 截断单段文本，保留头尾关键信息
 */
export function truncateContent(
  text: string,
  options: TruncateOptions = {}
): string {
  const { maxTokens = 4000, keepHead = 2000, keepTail = 1500 } = options;

  if (!text || estimateTokens(text) <= maxTokens) return text;

  const head = text.slice(0, keepHead);
  const tail = text.slice(-keepTail);

  return `${head}\n\n... [中间 ${estimateTokens(text.slice(keepHead, -keepTail || undefined))} tokens 已省略] ...\n\n${tail}`;
}

/**
 * 智能管理 Multi-Agent 上下文，确保总 token 数不超过限制。
 * 对较长的内容自动压缩，优先保留最新的输出（riskAgent 前的 planning/taskPlan）。
 *
 * @param sections - 各段文本的 { label, content } 数组，按重要性升序排列
 * @param promptTokens - 系统 prompt 自身的 token 数
 * @returns 压缩后的 sections 和总 token 估算
 */
export function manageContext(
  sections: Array<{ label: string; content: string }>,
  promptTokens = 1500
): { sections: typeof sections; totalTokens: number } {
  const available = MAX_INPUT_TOKENS - promptTokens;
  const total = sections.reduce((s, sec) => s + estimateTokens(sec.content), 0);

  if (total <= available) {
    return { sections, totalTokens: total + promptTokens };
  }

  // 按重要性（数组越后面越重要）分配 token 配额
  // 越前面的给越少的配额
  const processed = sections.map((sec, i) => {
    // 每个 section 的配额：前面少，后面多
    const weight = (i + 1) / sections.length;
    const quota = Math.max(800, Math.floor(available * weight / sections.length));
    return {
      ...sec,
      content: truncateContent(sec.content, {
        maxTokens: quota,
        keepHead: Math.floor(quota * 0.5),
        keepTail: Math.floor(quota * 0.4),
      }),
    };
  });

  const newTotal = processed.reduce((s, sec) => s + estimateTokens(sec.content), 0) + promptTokens;
  return { sections: processed, totalTokens: newTotal };
}
