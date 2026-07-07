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
  ARCHITECT_SECTIONS,
  DATABASE_SECTIONS,
  PLANNING_SECTIONS,
  RISK_SECTIONS,
} from "../evaluation/metrics";
import type { QualityReport } from "../evaluation/types";

// ---- 评估节点 ----

const llm = createLLM(0.2); // 低温度，提高稳定性

export async function evaluationAgentNode(
  state: typeof WorkflowState.State,
) {
  const { marketReport, productRequirements, architectureDesign, databaseDesign, taskPlan, riskAssessment } = state;

  // ============================================================
  // 第一轨：确定性指标（免费、可复现）
  // ============================================================

  // --- Market ---
  const marketSections = sectionCompleteness(marketReport || "", MARKET_SECTIONS);
  const marketCitations = countCitations(marketReport || "");
  const marketCompleteness = Math.round(marketSections.score * 100);

  // --- PM ---
  const pmSections = sectionCompleteness(productRequirements || "", PM_SECTIONS);
  const pmCitations = countCitations(productRequirements || "");
  const pmCompleteness = Math.round(pmSections.score * 100);

  // --- Architect ---
  const archSections = sectionCompleteness(architectureDesign || "", ARCHITECT_SECTIONS);
  const archCitations = countCitations(architectureDesign || "");
  const archCompleteness = Math.round(archSections.score * 100);

  // --- Database ---
  const dbSections = sectionCompleteness(databaseDesign || "", DATABASE_SECTIONS);
  const dbCitations = countCitations(databaseDesign || "");
  const dbCompleteness = Math.round(dbSections.score * 100);

  // --- Planning ---
  const planSections = sectionCompleteness(taskPlan || "", PLANNING_SECTIONS);
  const planCitations = countCitations(taskPlan || "");
  const planCompleteness = Math.round(planSections.score * 100);

  // --- Risk ---
  const riskSections = sectionCompleteness(riskAssessment || "", RISK_SECTIONS);
  const riskCitations = countCitations(riskAssessment || "");
  const riskCompleteness = Math.round(riskSections.score * 100);

  // --- 确定性覆盖率 ---
  const coverageResult = deterministicRequirementCoverage(
    marketReport || "",
    productRequirements || "",
  );

  // ============================================================
  // 第二轨：LLM 语义指标（一次调用批量判，省 token）
  // ============================================================

  const semanticPrompt = `
你是一位资深技术评审专家。请针对以下 Agent 输出进行质量评分。

## Market Agent 输出
${(marketReport || "").slice(0, 2000)}

## PM Agent 输出
${(productRequirements || "").slice(0, 2000)}

## Architect Agent 输出
${(architectureDesign || "").slice(0, 2000)}

## Database Agent 输出
${(databaseDesign || "").slice(0, 2000)}

## Planning Agent 输出
${(taskPlan || "").slice(0, 2000)}

## Risk Agent 输出
${(riskAssessment || "").slice(0, 2000)}

## 评分任务

请逐项评分（0-100 整数），并附 1-2 句理由：

1. **marketAccuracy**: 市场分析数据可信度——数据是否有据可循？是否在虚构数据？结论是否合理？
2. **prdQuality**: PRD 整体质量——需求是否清晰、可测试？优先级是否合理？MVP 边界是否明确？
3. **requirementCoverage**: PRD 是否覆盖了市场分析中识别到的核心需求？
   （参考：程序统计覆盖率约 ${Math.round(coverageResult.coverageRate * 100)}%）
4. **architectFeasibility**: 架构方案可行性——技术栈选型是否合理？模块划分是否清晰？部署方案是否可行？
5. **architectTechRisk**: 架构中技术风险——是否识别了关键技术风险并给出缓解方案？
6. **dbNormalization**: 数据库设计规范化——表结构是否合理？索引设计是否匹配查询场景？是否有冗余？
7. **planExecutability**: 开发计划可落地性——里程碑划分是否合理？依赖关系是否明确？
8. **planEstimation**: 工时估算合理性——任务拆解是否到位？工时估算是否靠谱？
9. **riskCoverage**: 风险覆盖度——是否完整覆盖了技术/商业/运营三类风险？应对策略是否具体？

## 输出格式（严格 JSON，只输出 JSON）

\`\`\`json
{
  "marketAccuracy": 78,
  "marketAccuracyReason": "...",
  "prdQuality": 82,
  "prdQualityReason": "...",
  "requirementCoverage": 75,
  "requirementCoverageReason": "...",
  "architectFeasibility": 80,
  "architectFeasibilityReason": "...",
  "architectTechRisk": 72,
  "architectTechRiskReason": "...",
  "dbNormalization": 78,
  "dbNormalizationReason": "...",
  "planExecutability": 75,
  "planExecutabilityReason": "...",
  "planEstimation": 70,
  "planEstimationReason": "...",
  "riskCoverage": 80,
  "riskCoverageReason": "..."
}
\`\`\`
`;

  type SemanticScores = {
    marketAccuracy: number;
    prdQuality: number;
    requirementCoverage: number;
    architectFeasibility: number;
    architectTechRisk: number;
    dbNormalization: number;
    planExecutability: number;
    planEstimation: number;
    riskCoverage: number;
  };

  let semanticScores: SemanticScores = {
    marketAccuracy: 70,
    prdQuality: 70,
    requirementCoverage: 70,
    architectFeasibility: 70,
    architectTechRisk: 70,
    dbNormalization: 70,
    planExecutability: 70,
    planEstimation: 70,
    riskCoverage: 70,
  };

  try {
    const result = await llm.invoke(semanticPrompt);
    const text = result.content as string;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      semanticScores = {
        marketAccuracy: clampScore(parsed.marketAccuracy) ?? semanticScores.marketAccuracy,
        prdQuality: clampScore(parsed.prdQuality) ?? semanticScores.prdQuality,
        requirementCoverage: clampScore(parsed.requirementCoverage) ?? semanticScores.requirementCoverage,
        architectFeasibility: clampScore(parsed.architectFeasibility) ?? semanticScores.architectFeasibility,
        architectTechRisk: clampScore(parsed.architectTechRisk) ?? semanticScores.architectTechRisk,
        dbNormalization: clampScore(parsed.dbNormalization) ?? semanticScores.dbNormalization,
        planExecutability: clampScore(parsed.planExecutability) ?? semanticScores.planExecutability,
        planEstimation: clampScore(parsed.planEstimation) ?? semanticScores.planEstimation,
        riskCoverage: clampScore(parsed.riskCoverage) ?? semanticScores.riskCoverage,
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
  const marketCitationScore = Math.min(100, marketCitations * 10);
  const marketOverall = Math.round(
    marketCompleteness * 0.2 + semanticScores.marketAccuracy * 0.4 + marketCitationScore * 0.4,
  );

  // PM 总分 = PRD质量(40%) + 覆盖率(30%) + 完整度(30%)
  const pmOverall = Math.round(
    semanticScores.prdQuality * 0.4 + semanticScores.requirementCoverage * 0.3 + pmCompleteness * 0.3,
  );

  // Architect 总分 = 可行度(30%) + 技术风险(30%) + 完整度(20%) + 引用(20%)
  const archCitationScore = Math.min(100, archCitations * 10);
  const archOverall = Math.round(
    semanticScores.architectFeasibility * 0.3 + semanticScores.architectTechRisk * 0.3 + archCompleteness * 0.2 + archCitationScore * 0.2,
  );

  // Database 总分 = 规范化(40%) + 完整度(30%) + 引用(30%)
  const dbCitationScore = Math.min(100, dbCitations * 10);
  const dbOverall = Math.round(
    semanticScores.dbNormalization * 0.4 + dbCompleteness * 0.3 + dbCitationScore * 0.3,
  );

  // Planning 总分 = 可落地(35%) + 估算(25%) + 完整度(20%) + 引用(20%)
  const planCitationScore = Math.min(100, planCitations * 10);
  const planOverall = Math.round(
    semanticScores.planExecutability * 0.35 + semanticScores.planEstimation * 0.25 + planCompleteness * 0.2 + planCitationScore * 0.2,
  );

  // Risk 总分 = 覆盖度(50%) + 完整度(30%) + 引用(20%)
  const riskCitationScore = Math.min(100, riskCitations * 10);
  const riskOverall = Math.round(
    semanticScores.riskCoverage * 0.5 + riskCompleteness * 0.3 + riskCitationScore * 0.2,
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
    architect: {
      completeness: archCompleteness,
      feasibility: semanticScores.architectFeasibility,
      techRisk: semanticScores.architectTechRisk,
      citationCount: archCitations,
      overall: archOverall,
    },
    database: {
      completeness: dbCompleteness,
      normalization: semanticScores.dbNormalization,
      citationCount: dbCitations,
      overall: dbOverall,
    },
    planning: {
      completeness: planCompleteness,
      executability: semanticScores.planExecutability,
      estimation: semanticScores.planEstimation,
      citationCount: planCitations,
      overall: planOverall,
    },
    risk: {
      completeness: riskCompleteness,
      coverage: semanticScores.riskCoverage,
      citationCount: riskCitations,
      overall: riskOverall,
    },
    overall: Math.round(
      marketOverall * 0.2 + pmOverall * 0.2 + archOverall * 0.2 + dbOverall * 0.1 + planOverall * 0.2 + riskOverall * 0.1,
    ),
    scoredAt: new Date().toISOString(),
  };

  console.log(
    `[EvaluationAgent] 评分完成: M=${marketOverall} PM=${pmOverall} A=${archOverall} DB=${dbOverall} P=${planOverall} R=${riskOverall} Overall=${qualityReport.overall}/100`,
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
