import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function riskAgentNode(state: typeof WorkflowState.State) {
  const {
    projectContext,
    marketReport,
    productRequirements,
    architectureDesign,
    databaseDesign,
    taskPlan,
  } = state;

  const prompt = `
你是一位资深风险管理专家。基于项目的完整分析，输出全面的风险评估报告。

项目信息：
${JSON.stringify(projectContext, null, 2)}

市场分析报告：
${marketReport}

产品需求文档：
${productRequirements}

技术架构设计：
${architectureDesign}

数据库设计：
${databaseDesign || "暂无"}

开发计划：
${taskPlan}

请从以下维度输出风险评估报告：

1. **技术风险**
   - 技术选型风险（成熟度、社区支持、学习曲线）
   - 架构风险（可扩展性、性能瓶颈、单点故障）
   - 数据安全风险（数据泄露、合规性）
   - 技术债务风险评估
   - 集成风险（第三方依赖稳定性）

2. **商业风险**
   - 市场竞争风险（竞争对手动态、市场份额）
   - 商业模式风险（盈利模型验证、定价策略）
   - 用户获取风险（获客成本、转化率预期）
   - 法规合规风险（行业监管、政策变化）
   - 资金链风险（烧钱速度、融资节奏）

3. **运营风险**
   - 团队风险（关键人员依赖、技能缺口）
   - 时间线风险（里程碑延期可能性）
   - 质量风险（测试覆盖、技术债累积）
   - 运维风险（监控、容灾、应急预案）

4. **风险矩阵**
   - 每个风险按"影响程度 × 发生概率"排序
   - 标记高/中/低风险等级

5. **应对策略**
   - 每个高风险项的缓解措施
   - 应急预案
   - 风险监控指标

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    riskAssessment: result.content as string,
    currentStep: "risk_done",
  };
}
