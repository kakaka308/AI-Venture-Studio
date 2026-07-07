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

export interface QualityReport {
  market: MarketQuality;
  pm: PMQuality;
  overall: number; // 各 Agent 加权平均
  scoredAt: string; // ISO timestamp
}
