import { ChatOpenAI } from "@langchain/openai";

/** Multi-Agent 工作流中每个 Agent 节点的 LLM 调用超时（毫秒） */
const AGENT_LLM_TIMEOUT_MS = 180_000; // 3 分钟

export function createLLM(temperature = 0.7) {
  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature,
    apiKey: process.env.QWEN_API_KEY!,
    timeout: AGENT_LLM_TIMEOUT_MS,
    maxRetries: 1,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      timeout: AGENT_LLM_TIMEOUT_MS,
    },
  });
}
