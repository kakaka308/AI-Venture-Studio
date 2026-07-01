// ============================================================
// 可观测性事件总线 - Event Bus
// 使用 Node.js EventEmitter 在 API 路由和 WebSocket 服务器之间通信
// ============================================================

import { EventEmitter } from "events";
import type { ObservabilityEvent } from "./types";

class ObservabilityBus extends EventEmitter {
  private static instance: ObservabilityBus;

  static getInstance(): ObservabilityBus {
    if (!ObservabilityBus.instance) {
      ObservabilityBus.instance = new ObservabilityBus();
      ObservabilityBus.instance.setMaxListeners(100);
    }
    return ObservabilityBus.instance;
  }

  /** 发布可观测性事件 */
  emitEvent(event: ObservabilityEvent): void {
    // 发布到全局频道
    this.emit("observability", event);
    // 发布到 traceId 专用频道
    this.emit(`trace:${event.traceId}`, event);
    // 发布到对话频道
    if (event.conversationId) {
      this.emit(`conversation:${event.conversationId}`, event);
    }
  }

  /** 订阅特定对话的事件 */
  onConversation(
    conversationId: string,
    handler: (event: ObservabilityEvent) => void
  ): () => void {
    const channel = `conversation:${conversationId}`;
    this.on(channel, handler);
    return () => this.off(channel, handler);
  }

  /** 订阅所有事件 */
  onAll(handler: (event: ObservabilityEvent) => void): () => void {
    this.on("observability", handler);
    return () => this.off("observability", handler);
  }
}

export const observabilityBus = ObservabilityBus.getInstance();
