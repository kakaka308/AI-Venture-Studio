import { ChatOpenAI } from "@langchain/openai";

export function createLLM(temperature = 0.7) {
  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature,
    apiKey: process.env.QWEN_API_KEY!,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });
}
