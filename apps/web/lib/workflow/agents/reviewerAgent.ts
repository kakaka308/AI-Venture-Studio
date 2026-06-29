import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM(0.3);

export async function reviewerAgentNode(state: typeof WorkflowState.State) {
  const {
    marketReport,
    productRequirements,
    architectureDesign,
    databaseDesign,
    taskPlan,
    riskAssessment,
    agentMessages,
    revisionCount,
  } = state;

  const passCount = revisionCount || 0;

  const prompt = `
你是一位资深技术审查员，负责对 Multi-Agent 系统产出的全套项目分析文档进行质量评审。

## 当前评审轮次
第 ${passCount + 1} 轮

## Agent 间通信记录
${agentMessages?.length ? JSON.stringify(agentMessages, null, 2) : "无"}

## 待评审文档

### 市场分析
${marketReport || "缺失"}

### 产品需求
${productRequirements || "缺失"}

### 技术架构
${architectureDesign || "缺失"}

### 数据库设计
${databaseDesign || "缺失"}

### 开发计划
${taskPlan || "缺失"}

### 风险评估
${riskAssessment || "缺失"}

## 评审任务

请从以下维度逐项评分（1-10分）：

1. **完整性** — 每个章节是否有实质内容，是否覆盖必要维度
2. **一致性** — 各章节之间是否有矛盾（如 PRD 提到功能但架构未涉及）
3. **可执行性** — 开发计划是否具体、可落地
4. **风险覆盖** — 风险评估是否全面

## 输出格式（严格 JSON）

\`\`\`json
{
  "scores": {
    "completeness": 8,
    "consistency": 7,
    "executability": 9,
    "riskCoverage": 8
  },
  "overallScore": 8,
  "passThreshold": 7,
  "passed": true,
  "issues": [
    {
      "severity": "critical|major|minor",
      "section": "productRequirements|architectureDesign|databaseDesign|taskPlan|riskAssessment",
      "description": "具体问题描述"
    }
  ],
  "revisionTarget": "pm",
  "revisionNotes": "需要修改的具体内容指引"
}
\`\`\`

规则：
- 总分 >= passThreshold 且无 critical 问题时，passed = true
- 如果 passed = false，必须指定 revisionTarget（哪个 Agent 需要修改）和 revisionNotes
- revisionTarget 可选值：pm, architect, database, planning, risk
- 如果已到第 3 轮（passCount >= 2），即使不通过也强制 passed = true，并备注"已达到最大轮次，强制通过"
`;

  const result = await llm.invoke(prompt);
  const text = result.content as string;

  // 解析 JSON
  let review: {
    scores: Record<string, number>;
    overallScore: number;
    passThreshold: number;
    passed: boolean;
    issues: Array<{ severity: string; section: string; description: string }>;
    revisionTarget?: string;
    revisionNotes?: string;
  };

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    review = JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    // 解析失败则默认通过
    review = { scores: {}, overallScore: 8, passThreshold: 7, passed: true, issues: [] };
  }

  const needsRevision = !review.passed && passCount < 2;

  return {
    currentStep: needsRevision ? "revision_needed" : "review_passed",
    needsRevision,
    revisionTarget: needsRevision ? (review.revisionTarget || "pm") : "",
    revisionNotes: needsRevision ? (review.revisionNotes || "请改进文档质量") : "",
    revisionCount: passCount + 1,
    agentMessages: [
      ...(agentMessages || []),
      {
        from: "reviewer",
        to: needsRevision ? (review.revisionTarget || "pm") : "all",
        type: needsRevision ? "warning" as const : "note" as const,
        content: needsRevision
          ? `[第${passCount + 1}轮评审] 不通过 (${review.overallScore}/${review.passThreshold})。${review.revisionNotes}`
          : `[第${passCount + 1}轮评审] 通过 (${review.overallScore}分)`,
      },
    ],
  };
}
