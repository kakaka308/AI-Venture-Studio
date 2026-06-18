"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Check,
  X,
  Calendar,
  User,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
} from "lucide-react";

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

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  urgent:      { label: "紧急", color: "bg-red-100 text-red-700 border-red-300",     icon: <AlertTriangle className="w-3 h-3" /> },
  high:        { label: "高",   color: "bg-orange-100 text-orange-700 border-orange-300", icon: <ArrowUp className="w-3 h-3" /> },
  medium:      { label: "中",   color: "bg-blue-100 text-blue-700 border-blue-300",   icon: <Minus className="w-3 h-3" /> },
  low:         { label: "低",   color: "bg-gray-100 text-gray-600 border-gray-300",   icon: <ArrowDown className="w-3 h-3" /> },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  todo:        { label: "待开始", color: "bg-gray-100 text-gray-600" },
  in_progress: { label: "进行中", color: "bg-yellow-100 text-yellow-700" },
  done:        { label: "已完成", color: "bg-green-100 text-green-700" },
  cancelled:   { label: "已取消", color: "bg-gray-100 text-gray-400 line-through" },
};

const STATUS_TABS = [
  { key: "",              label: "全部" },
  { key: "todo",          label: "待开始" },
  { key: "in_progress",   label: "进行中" },
  { key: "done",          label: "已完成" },
] as const;

const PRIORITY_TABS = [
  { key: "",        label: "全部紧急度" },
  { key: "urgent",  label: "紧急" },
  { key: "high",    label: "高" },
  { key: "medium",  label: "中" },
  { key: "low",     label: "低" },
] as const;

// ─── Create Task Form ────────────────────────────────────────────
function CreateTaskForm({
  projectId,
  onCreated,
  onCancel,
}: {
  projectId: string;
  onCreated: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status,
          dueDate: dueDate || undefined,
          assignedTo: assignedTo.trim() || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
      }
    } catch (err) {
      console.error("创建任务失败:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700">新建任务</h3>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="任务标题 *"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        autoFocus
        required
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="任务描述（可选）"
        rows={2}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Priority */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">优先级</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          >
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">状态</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          >
            {Object.entries(STATUS_CONFIG)
              .filter(([k]) => k !== "cancelled")
              .map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
          </select>
        </div>

        {/* Due date */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">截止日期</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Assignee */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">负责人</label>
          <input
            type="text"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="负责人名称"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          创建任务
        </button>
      </div>
    </form>
  );
}

// ─── Task Detail Modal ───────────────────────────────────────────
function TaskDetailModal({
  task,
  projectId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  task: Task;
  projectId: string;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [assignedTo, setAssignedTo] = useState(task.assignedTo ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasChanges =
    title !== task.title ||
    description !== (task.description ?? "") ||
    priority !== task.priority ||
    status !== task.status ||
    dueDate !== (task.dueDate ? task.dueDate.slice(0, 10) : "") ||
    assignedTo !== (task.assignedTo ?? "");

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || "",
          priority,
          status,
          dueDate: dueDate || null,
          assignedTo: assignedTo.trim() || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdated(updated);
      }
    } catch (err) {
      console.error("更新任务失败:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定要删除这个任务吗？")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted(task.id);
      }
    } catch (err) {
      console.error("删除任务失败:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">任务详情</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* Grid fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">优先级</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">状态</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                >
                  {Object.entries(STATUS_CONFIG)
                    .filter(([k]) => k !== "cancelled")
                    .map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">截止日期</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">负责人</label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="负责人名称"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {/* Created / Updated info */}
            <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
              <p>创建时间：{new Date(task.createdAt).toLocaleString()}</p>
              <p>最后更新：{new Date(task.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              删除
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !hasChanges}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存修改
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main TaskList Component ─────────────────────────────────────
export default function TaskList({ projectId, refreshTrigger }: { projectId: string; refreshTrigger?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTasks = useCallback(async (signal: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const qs = params.toString();
      const url = qs
        ? `/api/projects/${projectId}/tasks?${qs}`
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
  }, [projectId, statusFilter, priorityFilter]);

  useEffect(() => {
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

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev]);
    setShowCreateForm(false);
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(null);
  }

  function handleTaskDeleted(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
  }

  // Count by status (for the tabs)
  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  // Priority counts (global, for display only)
  const priorityCounts = {
    urgent: tasks.filter((t) => t.priority === "urgent").length,
    high: tasks.filter((t) => t.priority === "high").length,
    medium: tasks.filter((t) => t.priority === "medium").length,
    low: tasks.filter((t) => t.priority === "low").length,
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-8">
        <Loader2 className="inline-block w-5 h-5 animate-spin mr-2 align-middle text-blue-500" />
        加载任务中...
      </div>
    );
  }

  const tabStyle = (active: boolean, accentClass = "bg-blue-600 text-white") =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? accentClass : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  const priorityTabStyle = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active
        ? "bg-gray-800 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div>
      {/* ── Create button ── */}
      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 mb-4 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新建任务
        </button>
      )}

      {/* ── Create form ── */}
      {showCreateForm && (
        <div className="mb-4">
          <CreateTaskForm
            projectId={projectId}
            onCreated={handleTaskCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {/* ── Status filter tabs ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          let accent = "bg-blue-600 text-white";
          if (tab.key === "in_progress") accent = "bg-yellow-500 text-white";
          if (tab.key === "done") accent = "bg-green-600 text-white";
          return (
            <button
              key={tab.key || "all-status"}
              onClick={() => setStatusFilter(tab.key)}
              className={tabStyle(active, accent)}
            >
              {tab.label}
              {tab.key === "" && ` (${tasks.length})`}
              {tab.key === "todo" && ` (${counts.todo})`}
              {tab.key === "in_progress" && ` (${counts.in_progress})`}
              {tab.key === "done" && ` (${counts.done})`}
            </button>
          );
        })}
      </div>

      {/* ── Priority filter tabs ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {PRIORITY_TABS.map((tab) => {
          const active = priorityFilter === tab.key;
          let accent = "bg-gray-800 text-white";
          if (tab.key === "urgent") accent = "bg-red-600 text-white";
          if (tab.key === "high") accent = "bg-orange-500 text-white";
          if (tab.key === "medium") accent = "bg-blue-600 text-white";
          if (tab.key === "low") accent = "bg-gray-600 text-white";
          return (
            <button
              key={tab.key || "all-priority"}
              onClick={() => setPriorityFilter(tab.key)}
              className={priorityTabStyle(active) + (active ? ` ${accent}` : "")}
              style={active ? {} : undefined}
            >
              {tab.label}
              {tab.key === "" && ` (${tasks.length})`}
              {tab.key === "urgent" && ` (${priorityCounts.urgent})`}
              {tab.key === "high" && ` (${priorityCounts.high})`}
              {tab.key === "medium" && ` (${priorityCounts.medium})`}
              {tab.key === "low" && ` (${priorityCounts.low})`}
            </button>
          );
        })}
      </div>

      {/* ── Task list ── */}
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
            <Check className="w-5 h-5 opacity-40" />
          </div>
          {statusFilter || priorityFilter
            ? "没有匹配的任务"
            : "暂无任务，点击上方按钮创建或去 AI 助手中让 Agent 帮你创建吧！"}
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
                onClick={() => setSelectedTask(task)}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all bg-white cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  {/* Status checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTaskStatus(task.id, isDone ? "todo" : "done");
                    }}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-green-400"
                    }`}
                    title={isDone ? "标记为未完成" : "标记为已完成"}
                  >
                    {isDone && <Check className="w-3 h-3" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {task.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${priority.color}`}>
                        {priority.icon}
                        {priority.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {task.description && (
                      <p className={`text-xs mt-1 line-clamp-1 ${isDone ? "text-gray-300" : "text-gray-500"}`}>
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {task.assignedTo && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.assignedTo}
                        </span>
                      )}
                      <span>创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Quick delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("确定要删除这个任务吗？")) {
                        fetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" }).then((res) => {
                          if (res.ok) handleTaskDeleted(task.id);
                        });
                      }
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0"
                    title="删除任务"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Task Detail Modal ── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onUpdated={handleTaskUpdated}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
