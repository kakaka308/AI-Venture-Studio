// ============================================================
// 质量评估类型定义
// ============================================================

export interface AgentQuality {
  completeness: number;
  citationCount: number;
  overall: number; // 0-100
}

export interface MarketQuality extends AgentQuality {
  accuracy: number; // LLM 语义判：数据是否靠谱
}

export interface PMQuality extends AgentQuality {
  prdQuality: number; // LLM 语义判：清晰/可测/优先级
  requirementCoverage: number; // 混合：确定性覆盖率 + LLM 调整
}

export interface ArchitectQuality extends AgentQuality {
  feasibility: number; // LLM 语义：方案可行性
  techRisk: number; // LLM 语义：技术风险评估质量
}

export interface DatabaseQuality extends AgentQuality {
  normalization: number; // LLM 语义：表/索引设计合理性
}

export interface PlanningQuality extends AgentQuality {
  executability: number; // LLM 语义：计划可落地性
  estimation: number; // LLM 语义：工时估算合理性
}

export interface RiskQuality extends AgentQuality {
  coverage: number; // LLM 语义：风险覆盖度
}

export interface QualityReport {
  market: MarketQuality;
  pm: PMQuality;
  architect: ArchitectQuality;
  database: DatabaseQuality;
  planning: PlanningQuality;
  risk: RiskQuality;
  overall: number; // 各 Agent 加权平均
  scoredAt: string; // ISO timestamp
}
