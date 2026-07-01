// ============================================================
// WebSocket 服务器 - 推送可观测性事件到前端
// 通过 instrumentation.ts 在 Next.js 启动时自动初始化
// ============================================================

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { observabilityBus } from "./event-bus";
import type { ObservabilityEvent } from "./types";

let wss: WebSocketServer | null = null;

/** 客户端连接管理 */
const clients = new Map<string, Set<WebSocket>>();

export function startWSServer(port = 3200) {
  if (wss) {
    console.log("[Observability] WebSocket 服务器已在运行");
    return wss;
  }

  wss = new WebSocketServer({ port });

  wss.on("listening", () => {
    console.log(`[Observability] WebSocket 服务器已启动 → ws://localhost:${port}`);
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const conversationId = url.searchParams.get("conversationId") || "global";

    if (!clients.has(conversationId)) {
      clients.set(conversationId, new Set());
    }
    clients.get(conversationId)!.add(ws);

    // 发送连接确认
    ws.send(
      JSON.stringify({
        type: "connected",
        traceId: "system",
        timestamp: Date.now(),
        data: { conversationId, message: "已连接到可观测性服务" },
      })
    );

    // 订阅该对话的事件并转发
    const unsubscribe = observabilityBus.onConversation(
      conversationId,
      (event: ObservabilityEvent) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(event));
        }
      }
    );

    // 心跳检测
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    ws.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      const set = clients.get(conversationId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(conversationId);
      }
    });

    ws.on("error", (err: Error) => {
      console.error("[Observability] WebSocket 客户端错误:", err.message);
    });
  });

  // 订阅所有事件用于全局监控
  observabilityBus.onAll((event) => {
    const globalClients = clients.get("global");
    if (globalClients) {
      const msg = JSON.stringify(event);
      globalClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    }
  });

  wss.on("error", (err: Error) => {
    console.error("[Observability] WebSocket 服务器错误:", err);
  });

  return wss;
}

export function stopWSServer() {
  if (wss) {
    wss.close();
    wss = null;
    console.log("[Observability] WebSocket 服务器已停止");
  }
}
