import { createLLM } from "../llm";
import type { WorkflowState } from "../state";

const llm = createLLM();

export async function databaseAgentNode(state: typeof WorkflowState.State) {
  const { projectContext, productRequirements, architectureDesign } = state;

  const prompt = `
你是一位资深数据库架构师。基于产品需求和技术架构，设计完整的数据库方案。

项目信息：
${JSON.stringify(projectContext, null, 2)}

产品需求：
${productRequirements}

技术架构：
${architectureDesign}

请从以下维度输出数据库设计文档：

1. **ER 图设计（文字描述）**
   - 列出所有核心实体
   - 描述实体之间的关系（一对一、一对多、多对多）
   - 用文字绘制 ER 关系图

2. **数据模型设计**
   - 每个表的完整字段定义（字段名、类型、约束、默认值）
   - 主键、外键设计
   - 各表的用途说明

3. **索引设计**
   - 列出需要创建的索引
   - 说明每个索引的查询场景
   - 联合索引设计

4. **分库分表策略**
   - 如果有必要，给出分库分表方案
   - 数据量预估与扩容策略

5. **数据迁移方案**
   - 版本管理策略
   - 灰度迁移步骤

输出格式：Markdown
`;

  const result = await llm.invoke(prompt);

  return {
    databaseDesign: result.content as string,
    currentStep: "database_done",
  };
}
