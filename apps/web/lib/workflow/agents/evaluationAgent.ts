// ============================================================
// 质量评估 Agent —— 双轨制：确定性指标 + LLM 语义指标
// ============================================================

import { createLLM } from "../llm";
import type { WorkflowState } from "../state";
import {
  countCitations,
  sectionCompleteness,
  deterministicRequirementCoverage,
  MARKET_SECTIONS,
  PM_SECTIONS,
} from "../evaluation/metrics";
import type { QualityReport } from "../evaluation/types";

// ---- 评估节点 ----

const llm = createLLM(0.2); // 低温度，提高稳定性

export async function evaluationAgentNode(
  state: typeof WorkflowState.State,
) {
  const { marketReport, productRequirements } = state;

  // ============================================================
  // 第一轨：确定性指标（免费、可复现）
  // ============================================================

  // --- Market ---
  const marketSections = sectionCompleteness(
    marketReport || "",
    MARKET_SECTIONS,
  );
  const marketCitations = countCitations(marketReport || "");
  const marketCompleteness = Math.round(marketSections.score * 100);

  // --- PM ---
  const pmSections = sectionCompleteness(
    productRequirements || "",
    PM_SECTIONS,
  );
  const pmCitations = countCitations(productRequirements || "");
  const pmCompleteness = Math.round(pmSections.score * 100);

  // --- 确定性覆盖率 ---
  const coverageResult = deterministicRequirementCoverage(
    marketReport || "",
    productRequirements || "",
  );

  // ============================================================
  // 第二轨：LLM 语义指标（一次调用批量判，省 token）
  // ============================================================

  const semanticPrompt = `
你是一位资深技术评审专家。请针对以下两份 Agent 输出进行质量评分。

## Market Agent 输出
${(marketReport || "").slice(0, 4000)}

## PM Agent 输出
${(productRequirements || "").slice(0, 4000)}

## 评分任务

请逐项评分（0-100 整数），并附 1-2 句理由：

1. **marketAccuracy**: 市场分析的数据可信度——数据是否有据可循？是否在虚构/编造数据？结论是否合理？
2. **prdQuality**: PRD 的整体质量——需求是否清晰、可测试？优先级是否合理？MVP 边界是否明确？
3. **requirementCoverage**: PRD 是否覆盖了市场分析中识别到的核心需求和痛点？
   （参考：确定性程序已统计到如下市场诉求 → PRD 覆盖的覆盖率约为 ${Math.round(coverageResult.coverageRate * 100)}%，但你需要用语义判断真正的深度覆盖程度）

## 输出格式（严格 JSON，只输出 JSON）

\`\`\`json
{
  "marketAccuracy": 78,
  "marketAccuracyReason": "数据有基本的市场规模引用，但部分竞品数据缺乏出处",
  "prdQuality": 82,
  "prdQualityReason": "用户故事清晰，MVP 范围合理，但非功能需求较简略",
  "requirementCoverage": 75,
  "requirementCoverageReason": "覆盖了大部分核心痛点，但市场提到的XX需求在PRD中未体现"
}
\`\`\`
`;

  let semanticScores: {
    marketAccuracy: number;
    prdQuality: number;
    requirementCoverage: number;
    marketAccuracyReason?: string;
    prdQualityReason?: string;
    requirementCoverageReason?: string;
  } = {
    marketAccuracy: 70,
    prdQuality: 70,
    requirementCoverage: 70,
  };

  try {
    const result = await llm.invoke(semanticPrompt);
    const text = result.content as string;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      semanticScores = {
        marketAccuracy:
          clampScore(parsed.marketAccuracy) ?? semanticScores.marketAccuracy,
        prdQuality:
          clampScore(parsed.prdQuality) ?? semanticScores.prdQuality,
        requirementCoverage:
          clampScore(parsed.requirementCoverage) ??
          semanticScores.requirementCoverage,
        marketAccuracyReason: parsed.marketAccuracyReason,
        prdQualityReason: parsed.prdQualityReason,
        requirementCoverageReason: parsed.requirementCoverageReason,
      };
    }
  } catch (err) {
    console.error(
      "[EvaluationAgent] LLM 语义评分解析失败:",
      err instanceof Error ? err.message : err,
    );
  }

  // ============================================================
  // 合并：确定性 + 语义 → 最终评分卡
  // ============================================================

  // Market 总分 = 完整度(20%) + 准确度(40%) + 引用数量(40%)
  // 引用分：0 个=0 分，10+ 个=100 分
  const marketCitationScore = Math.min(100, marketCitations * 10);
  const marketOverall = Math.round(
    marketCompleteness * 0.2 +
      semanticScores.marketAccuracy * 0.4 +
      marketCitationScore * 0.4,
  );

  // PM 总分 = PRD质量(40%) + 覆盖率(30%) + 完整度(30%)
  const pmOverall = Math.round(
    semanticScores.prdQuality * 0.4 +
      semanticScores.requirementCoverage * 0.3 +
      pmCompleteness * 0.3,
  );

  const qualityReport: QualityReport = {
    market: {
      completeness: marketCompleteness,
      accuracy: semanticScores.marketAccuracy,
      citationCount: marketCitations,
      overall: marketOverall,
    },
    pm: {
      completeness: pmCompleteness,
      prdQuality: semanticScores.prdQuality,
      citationCount: pmCitations,
      requirementCoverage: semanticScores.requirementCoverage,
      overall: pmOverall,
    },
    overall: Math.round(marketOverall * 0.45 + pmOverall * 0.55),
    scoredAt: new Date().toISOString(),
  };

  console.log(
    `[EvaluationAgent] 评分完成: Market=${marketOverall}/100, PM=${pmOverall}/100, Overall=${qualityReport.overall}/100`,
  );

  return {
    qualityReport,
    currentStep: "evaluation_done",
  };
}

// ---- 工具函数 ----

function clampScore(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}
