// ============================================================
// 确定性质量指标 —— 纯程序计算，免费、可复现、可进 CI
// ============================================================

// ---- 引用数量 ----

const MD_LINK = /\[[^\]]+\]\(https?:\/\/[^)\s]+\)/g;
const BARE_URL = /https?:\/\/[^\s)\]]+/g;
const NUM_CITE = /\[\d+\]/g;

/**
 * 统计报告中引用的数量（Markdown 链接 + 裸 URL + 数字角标，三者去重）
 */
export function countCitations(text: string): number {
  const mdMatches = text.match(MD_LINK) || [];
  const numMatches = text.match(NUM_CITE) || [];
  // 裸 URL 会与 md link 内的 URL 重复，所以只取非 md 内的
  const bareMatches = (text.match(BARE_URL) || []).filter((url) => {
    return !mdMatches.some((md) => md.includes(url));
  });
  return mdMatches.length + bareMatches.length + numMatches.length;
}

// ---- 章节完整度 ----

export interface SectionResult {
  score: number;
  matched: string[];
  missing: string[];
}

/**
 * 检查文档是否包含所有必备章节
 * @param text  文档全文
 * @param required  必备章节关键词数组
 * @returns 0-1 之间的分数，以及匹配/缺失列表
 */
export function sectionCompleteness(
  text: string,
  required: string[],
): SectionResult {
  const low = text.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  // 提取所有标题文本
  const headings = (text.match(/^#{1,4}\s+(.+)$/gm) || []).map((s) =>
    s.replace(/^#+\s+/, "").toLowerCase(),
  );

  for (const key of required) {
    const keyLower = key.toLowerCase();
    const inHeading = headings.some((h) => h.includes(keyLower));
    const inBody = low.includes(keyLower);
    if (inHeading || inBody) {
      matched.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    score: required.length > 0 ? matched.length / required.length : 1,
    matched,
    missing,
  };
}

// ---- 预设章节清单 ----

export const MARKET_SECTIONS = [
  "市场规模",
  "目标用户",
  "竞争格局",
  "市场机会",
  "差异化定位",
];

export const PM_SECTIONS = [
  "产品愿景",
  "用户故事",
  "功能需求",
  "非功能需求",
  "MVP",
];

export const ARCHITECT_SECTIONS = [
  "系统架构",
  "技术栈",
  "数据库设计",
  "API 设计",
  "部署",
  "技术风险",
];

export const DATABASE_SECTIONS = [
  "ER 图",
  "数据模型",
  "索引",
  "分库分表",
  "数据迁移",
];

export const PLANNING_SECTIONS = [
  "里程碑",
  "任务",
  "工时",
  "依赖",
  "风险",
];

export const RISK_SECTIONS = [
  "技术风险",
  "商业风险",
  "运营风险",
  "风险矩阵",
  "应对策略",
];

// ---- 需求覆盖率 ==============================================
// 统计 marketReport 中识别的机会/痛点，对比 PRD 中是否被功能覆盖

export interface CoverageResult {
  coverageRate: number; // 0-1 被覆盖的诉求比例
  painPoints: string[]; // 从市场中提取到的诉求关键词
  covered: string[]; // PRD 中已覆盖
  uncovered: string[]; // PRD 中缺失
}

/**
 * 从 marketReport 中提取关键诉求关键词（正则 + 简单规则混合）
 * 不依赖 LLM，作为覆盖率的下限参考
 */
export function extractPainPoints(marketText: string): string[] {
  const points: string[] = [];

  // 匹配 "- 痛点：xxx" 或 "机会：xxx" 等模式
  const painPatterns = [
    /(?:痛点|问题|机会|机遇|挑战|需求)[：:]\s*(.+)/gi,
    /(?:用户需要|用户渴望|用户期待|缺乏)\s*(.+)/gi,
    /(\d+)\.\s*([^：:\n]+(?:痛点|问题|需求|挑战|不足)[^：:\n]*)/gi,
  ];

  for (const pattern of painPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(marketText)) !== null) {
      const captured = (match[1] || match[2] || "").trim();
      if (captured.length > 3 && captured.length < 80) {
        points.push(captured);
      }
    }
  }

  // 去重相似
  return [...new Set(points)].slice(0, 15);
}

/**
 * 确定性覆盖率：统计市场提取的诉求关键词有多少出现在 PRD 中
 */
export function deterministicRequirementCoverage(
  marketText: string,
  prdText: string,
): CoverageResult {
  const painPoints = extractPainPoints(marketText);
  const prdLower = prdText.toLowerCase();

  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const point of painPoints) {
    if (prdLower.includes(point.toLowerCase())) {
      covered.push(point);
    } else {
      uncovered.push(point);
    }
  }

  return {
    coverageRate: painPoints.length > 0 ? covered.length / painPoints.length : 0,
    painPoints,
    covered,
    uncovered,
  };
}
