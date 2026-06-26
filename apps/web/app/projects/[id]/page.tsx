"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  targetAudience: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);

  // 编辑表单
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user && id) {
      fetch(`/api/projects/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("项目不存在");
          return res.json();
        })
        .then((data: Project) => {
          setProject(data);
          setName(data.name);
          setDescription(data.description || "");
          setIndustry(data.industry || "");
          setTargetAudience(data.targetAudience || "");
          setLoading(false);
        })
        .catch(() => {
          router.push("/projects");
        });
    }
  }, [session, id, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, industry, targetAudience }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProject(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除此项目吗？此操作不可恢复！")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/projects");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/projects")}
                className="text-gray-500 hover:text-gray-700"
              >
                ← 返回
              </button>
              <h1 className="text-xl font-bold truncate max-w-md">
                {project.name}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                创建于 {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* 基本信息卡片 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">基本信息</h2>
            <div className="flex gap-2">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
                  >
                    {deleting ? "删除中..." : "删除"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </>
              )}
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  行业
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="如：教育、金融、医疗"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目标用户
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="如：学生、企业用户"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">描述</span>
                <p className="text-gray-800">
                  {project.description || "暂无描述"}
                </p>
              </div>
              <div className="flex gap-8">
                <div>
                  <span className="text-sm text-gray-500">行业</span>
                  <p className="text-gray-800">
                    {project.industry || "未设置"}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">目标用户</span>
                  <p className="text-gray-800">
                    {project.targetAudience || "未设置"}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">最后更新</span>
                <p className="text-gray-800 text-sm">
                  {new Date(project.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 功能模块 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">项目模块</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push(`/projects/${id}/context`)}
              className="border rounded-lg p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <h3 className="font-medium text-blue-600">情境文件</h3>
              <p className="text-sm text-gray-500 mt-1">
                管理项目背景与上下文
              </p>
            </button>
            <button
              onClick={() => router.push(`/projects/${id}/memory`)}
              className="border rounded-lg p-4 text-left hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <h3 className="font-medium text-green-600">记忆系统</h3>
              <p className="text-sm text-gray-500 mt-1">
                查看与管理项目记忆
              </p>
            </button>
            <button
              onClick={() => router.push(`/projects/${id}/tasks`)}
              className="border rounded-lg p-4 text-left hover:border-purple-300 hover:bg-purple-50 transition-colors"
            >
              <h3 className="font-medium text-purple-600">任务管理</h3>
              <p className="text-sm text-gray-500 mt-1">
                跟踪项目任务与进度
              </p>
            </button>
            <button
              onClick={() => router.push(`/chat`)}
              className="border rounded-lg p-4 text-left hover:border-orange-300 hover:bg-orange-50 transition-colors"
            >
              <h3 className="font-medium text-orange-600">AI 创业助手</h3>
              <p className="text-sm text-gray-500 mt-1">
                与 AI 对话，获取创业建议
              </p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
