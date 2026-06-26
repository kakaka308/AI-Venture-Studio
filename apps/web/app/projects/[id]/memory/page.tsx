"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Portrait {
  industry: string;
  targetUsers: string;
  businessModel: string;
  keyInsights: string[];
  summary: string;
}

interface MemoryData {
  portrait: Portrait;
  lastExtractedAt: string | null;
}

export default function MemoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // 编辑表单
  const [industry, setIndustry] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [businessModel, setBusinessModel] = useState("");
  const [keyInsights, setKeyInsights] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user && id) {
      fetch(`/api/projects/${id}/memory`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data: MemoryData) => {
          setMemory(data);
          setIndustry(data.portrait.industry || "");
          setTargetUsers(data.portrait.targetUsers || "");
          setBusinessModel(data.portrait.businessModel || "");
          setKeyInsights(
            (data.portrait.keyInsights || []).join("\n")
          );
          setSummary(data.portrait.summary || "");
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session, id]);

  const startEdit = () => {
    setEditing(true);
  };

  const cancelEdit = () => {
    if (memory) {
      setIndustry(memory.portrait.industry || "");
      setTargetUsers(memory.portrait.targetUsers || "");
      setBusinessModel(memory.portrait.businessModel || "");
      setKeyInsights(
        (memory.portrait.keyInsights || []).join("\n")
      );
      setSummary(memory.portrait.summary || "");
    }
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/memory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          targetUsers,
          businessModel,
          keyInsights: keyInsights
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          summary,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMemory({
          portrait: updated.portrait,
          lastExtractedAt: updated.lastExtractedAt ?? null,
        });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
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
              <h1 className="text-xl font-bold">记忆系统</h1>
            </div>
            <div className="flex items-center gap-3">
              {!editing ? (
                <button
                  onClick={startEdit}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  编辑记忆
                </button>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            查看与管理项目长期记忆。AI 会从对话中自动学习并更新这些信息。
          </p>
          {memory?.lastExtractedAt && (
            <span className="text-xs text-gray-400">
              最后提取: {new Date(memory.lastExtractedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* 行业与目标用户 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">市场定位</h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  行业
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目标用户
                </label>
                <input
                  type="text"
                  value={targetUsers}
                  onChange={(e) => setTargetUsers(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="text-sm text-gray-400">行业</span>
                <p className="mt-1 text-gray-800">
                  {memory?.portrait.industry || "暂无数据"}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-400">目标用户</span>
                <p className="mt-1 text-gray-800">
                  {memory?.portrait.targetUsers || "暂无数据"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 商业模式 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">商业模式</h2>
          {editing ? (
            <textarea
              value={businessModel}
              onChange={(e) => setBusinessModel(e.target.value)}
              rows={3}
              placeholder="描述项目的商业模式..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-800 whitespace-pre-wrap">
              {memory?.portrait.businessModel || "暂无数据"}
            </p>
          )}
        </div>

        {/* 关键洞察 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">关键洞察</h2>
          {editing ? (
            <div>
              <p className="text-xs text-gray-400 mb-2">每行一个洞察</p>
              <textarea
                value={keyInsights}
                onChange={(e) => setKeyInsights(e.target.value)}
                rows={5}
                placeholder="关键洞察 1&#10;关键洞察 2&#10;..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              {memory?.portrait.keyInsights &&
              memory.portrait.keyInsights.length > 0 ? (
                <ul className="space-y-2">
                  {memory.portrait.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="text-gray-800">{insight}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">暂无关键洞察</p>
              )}
            </div>
          )}
        </div>

        {/* 总结 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">总结</h2>
          {editing ? (
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="项目的总体总结..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-800 whitespace-pre-wrap">
              {memory?.portrait.summary || "暂无总结"}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
