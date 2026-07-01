// ============================================================
// Next.js Instrumentation - 启动时初始化 WebSocket 服务器
// ============================================================

export async function register() {
  // 只在 Node.js 运行时启动 WebSocket（跳过 Edge runtime）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const wsPort = parseInt(process.env.OBSERVABILITY_WS_PORT || "3200", 10);
    const { startWSServer } = await import("./lib/observability/ws-server");
    startWSServer(wsPort);
  }
}
