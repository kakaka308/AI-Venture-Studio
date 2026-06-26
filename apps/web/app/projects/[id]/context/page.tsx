"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ContextData {
  industry: string | null;
  targetAudience: string | null;
  problem: string | null;
  valueProposition: string | null;
  competitors: string | null;
  stage: string | null;
  projectName: string;
  projectDescription: string | null;
  projectIndustry: string | null;
  projectTargetAudience: string | null;
}

const STAGE_OPTIONS = [
  { value: "idea", label: "创意阶段" },
  { value: "validation", label: "验证阶段" },
  { value: "prototype", label: "原型阶段" },
  { value: "mvp", label: "MVP 阶段" },
];

export default function ContextPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [context, setContext] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 表单
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [problem, setProblem] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [stage, setStage] = useState("idea");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user && id) {
      fetch(`/api/projects/${id}/context`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data: ContextData) => {
          setContext(data);
          setIndustry(data.industry || "");
          setTargetAudience(data.targetAudience || "");
          setProblem(data.problem || "");
          setValueProposition(data.valueProposition || "");
          setCompetitors(data.competitors || "");
          setStage(data.stage || "idea");
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session, id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${id}/context`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          targetAudience,
          problem,
          valueProposition,
          competitors,
          stage,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setContext((prev) =>
          prev ? { ...prev, ...updated } : prev
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
              <h1 className="text-xl font-bold">情境文件</h1>
              {context && (
                <span className="text-sm text-gray-400 ml-2">
                  {context.projectName}
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : saved ? "✓ 已保存" : "保存"}
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <p className="text-sm text-gray-500">
          管理项目背景、市场分析与核心价值主张。
        </p>

        {/* 行业与阶段 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                当前阶段
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 目标用户 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">目标用户</h2>
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            rows={3}
            placeholder="描述你的目标用户群体，如：18-25岁大学生、中小企业主..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 问题描述 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">核心问题</h2>
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            rows={4}
            placeholder="你的项目要解决什么核心问题？用户当前面临哪些痛点？"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 价值主张 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">价值主张</h2>
          <textarea
            value={valueProposition}
            onChange={(e) => setValueProposition(e.target.value)}
            rows={4}
            placeholder="你的解决方案是什么？为什么你的方案比现有的更好？"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 竞品分析 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">竞品分析</h2>
          <textarea
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            rows={4}
            placeholder="列出主要竞争对手及其优缺点，分析与你项目的差异..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </main>
    </div>
  );
}
