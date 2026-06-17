"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "紧急", color: "bg-red-100 text-red-700 border-red-300" },
  high: { label: "高", color: "bg-orange-100 text-orange-700 border-orange-300" },
  medium: { label: "中", color: "bg-blue-100 text-blue-700 border-blue-300" },
  low: { label: "低", color: "bg-gray-100 text-gray-600 border-gray-300" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  todo: { label: "待开始", color: "bg-gray-100 text-gray-600" },
  in_progress: { label: "进行中", color: "bg-yellow-100 text-yellow-700" },
  done: { label: "已完成", color: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-400 line-through" },
};

export default function TaskList({ projectId, refreshTrigger }: { projectId: string; refreshTrigger?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchTasks = useCallback(async (signal: AbortSignal) => {
    try {
      const url = filter
        ? `/api/projects/${projectId}/tasks?status=${filter}`
        : `/api/projects/${projectId}/tasks`;
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("加载任务失败:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  useEffect(() => {
    // 取消上一次未完成的请求，防止竞态条件
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading 状态需要随 filter 变化重置
    setLoading(true);
    fetchTasks(controller.signal);

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchTasks, refreshTrigger]);

  async function updateTaskStatus(taskId: string, newStatus: string) {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    }
  }

  async function deleteTask(taskId: string) {
    if (!confirm("确定要删除这个任务吗？")) return;
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-8">
        <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2 align-middle" />
        加载任务中...
      </div>
    );
  }

  // Count by status
  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !filter ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          全部 ({tasks.length})
        </button>
        <button
          onClick={() => setFilter("todo")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "todo" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          待开始 ({counts.todo})
        </button>
        <button
          onClick={() => setFilter("in_progress")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "in_progress" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          进行中 ({counts.in_progress})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "done" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          已完成 ({counts.done})
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="12" y2="17" />
          </svg>
          {filter ? "没有该状态的任务" : "暂无任务，去 AI 助手中让 Agent 帮你创建吧！"}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
            const isDone = task.status === "done";

            return (
              <div
                key={task.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors bg-white"
              >
                <div className="flex items-start gap-3">
                  {/* Status checkbox */}
                  <button
                    onClick={() => updateTaskStatus(task.id, isDone ? "todo" : "done")}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-green-400"
                    }`}
                    title={isDone ? "标记为未完成" : "标记为已完成"}
                  >
                    {isDone && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {task.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priority.color}`}>
                        {priority.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {task.description && (
                      <p className={`text-xs mt-1 ${isDone ? "text-gray-300" : "text-gray-500"}`}>
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      {task.dueDate && (
                        <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>
                      )}
                      {task.assignedTo && (
                        <span>👤 {task.assignedTo}</span>
                      )}
                      <span>创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0"
                    title="删除任务"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
