// ============================================================
// 可观测性 WebSocket 客户端 Hook
// ============================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ObservabilityEvent, ObservabilityTrace } from "./types";

interface UseObservabilityOptions {
  conversationId?: string | null;
  projectId?: string | null;
  enabled?: boolean;
  wsPort?: number;
}

interface UseObservabilityReturn {
  /** 当前 trace 记录 */
  currentTrace: ObservabilityTrace | null;
  /** 所有实时事件 */
  events: ObservabilityEvent[];
  /** 连接状态 */
  connected: boolean;
  /** 清空当前事件 */
  clearEvents: () => void;
}

export function useObservability({
  conversationId,
  projectId,
  enabled = true,
  wsPort = 3200,
}: UseObservabilityOptions): UseObservabilityReturn {
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [currentTrace, setCurrentTrace] = useState<ObservabilityTrace | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const params = new URLSearchParams();
    if (conversationId) params.set("conversationId", conversationId);
    if (projectId) params.set("projectId", projectId);

    const wsUrl = `${protocol}//${host}:${wsPort}?${params.toString()}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const event: ObservabilityEvent = JSON.parse(msg.data);

          // 跳过系统事件
          if (event.type === "connected" as never) return;

          setEvents((prev) => {
            const newEvents = [...prev, event];
            if (newEvents.length > 50) {
              return newEvents.slice(-50);
            }
            return newEvents;
          });

          // 更新当前 trace
          setCurrentTrace((prev) => {
            if (!prev || event.type.includes(":start")) {
              return {
                traceId: event.traceId,
                conversationId: event.conversationId,
                startTime: event.timestamp,
                steps: [event],
                model: event.model,
                runtime: event.runtime,
              };
            }
            return {
              ...prev,
              endTime: event.type.includes(":end") ? event.timestamp : prev.endTime,
              steps: [...prev.steps, event],
              model: prev.model || event.model,
              runtime: prev.runtime || event.runtime,
            };
          });
        } catch {
          // 忽略解析错误
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // 断线重连（通过 ref 引用避免循环依赖）
        reconnectTimer.current = setTimeout(() => {
          connectRef.current?.();
        }, 3000);
      };

      ws.onerror = () => {
        // 静默处理错误
      };
    } catch {
      // 连接失败
    }
  }, [enabled, conversationId, projectId, wsPort]);

  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setCurrentTrace(null);
  }, []);

  return {
    currentTrace,
    events,
    connected,
    clearEvents,
  };
}

