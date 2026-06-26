"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  urgent: { label: "紧急", color: "bg-red-100 text-red-700" },
  high: { label: "高", color: "bg-orange-100 text-orange-700" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  low: { label: "低", color: "bg-green-100 text-green-700" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  todo: { label: "待办", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "进行中", color: "bg-blue-100 text-blue-700" },
  done: { label: "已完成", color: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-700" },
};

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  // 创建表单
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newStatus, setNewStatus] = useState("todo");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchTasks = () => {
    if (session?.user) {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      fetch(`/api/projects/${id}/tasks?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          return res.json();
        })
        .then((data) => {
          setTasks(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  useEffect(() => {
    if (session?.user && id) fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id, filterStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || undefined,
          priority: newPriority,
          status: newStatus,
          dueDate: newDueDate || undefined,
          assignedTo: newAssignedTo || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewTitle("");
        setNewDescription("");
        setNewPriority("medium");
        setNewStatus("todo");
        setNewDueDate("");
        setNewAssignedTo("");
        fetchTasks();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await fetch(`/api/projects/${id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTasks();
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("确定删除此任务？")) return;
    await fetch(`/api/projects/${id}/tasks/${taskId}`, {
      method: "DELETE",
    });
    fetchTasks();
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/projects/${id}`)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← 返回项目
              </button>
              <h1 className="text-xl font-bold">任务管理</h1>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              + 新建任务
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <p className="text-sm text-gray-500">跟踪项目任务与进度。</p>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="ml-auto border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">全部状态</option>
            <option value="todo">待办</option>
            <option value="in_progress">进行中</option>
            <option value="done">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>

        {/* 创建任务表单 */}
        {showCreate && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">新建任务</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="任务标题 *"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="任务描述（可选）"
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-2 text-sm"
                >
                  <option value="low">低优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="high">高优先级</option>
                  <option value="urgent">紧急</option>
                </select>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-2 text-sm"
                >
                  <option value="todo">待办</option>
                  <option value="in_progress">进行中</option>
                  <option value="done">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-2 text-sm"
                />
                <input
                  type="text"
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  placeholder="负责人"
                  className="border border-gray-300 rounded px-2 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "创建中..." : "创建任务"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 任务列表 */}
        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-400">暂无任务</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 text-blue-600 text-sm hover:text-blue-800"
            >
              创建第一个任务
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-lg shadow p-4 flex items-start gap-4"
              >
                {/* 状态选择 */}
                <select
                  value={task.status}
                  onChange={(e) =>
                    handleStatusChange(task.id, e.target.value)
                  }
                  className={`text-xs rounded px-2 py-1 border-0 cursor-pointer ${
                    STATUS_MAP[task.status]?.color || "bg-gray-100"
                  }`}
                >
                  <option value="todo">待办</option>
                  <option value="in_progress">进行中</option>
                  <option value="done">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>

                {/* 任务内容 */}
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-medium ${
                      task.status === "done"
                        ? "line-through text-gray-400"
                        : task.status === "cancelled"
                        ? "line-through text-gray-300"
                        : "text-gray-800"
                    }`}
                  >
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        PRIORITY_MAP[task.priority]?.color || ""
                      }`}
                    >
                      {PRIORITY_MAP[task.priority]?.label || task.priority}
                    </span>
                    {task.assignedTo && (
                      <span className="text-xs text-gray-400">
                        负责人: {task.assignedTo}
                      </span>
                    )}
                    {task.dueDate && (
                      <span
                        className={`text-xs ${
                          new Date(task.dueDate) < new Date() &&
                          task.status !== "done" &&
                          task.status !== "cancelled"
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        截止: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
