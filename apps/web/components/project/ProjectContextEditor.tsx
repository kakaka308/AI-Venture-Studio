"use client";

import { useState, useEffect, useCallback } from "react";

interface ProjectContext {
  id?: string;
  industry?: string;
  targetAudience?: string;
  problem?: string;
  valueProposition?: string;
  competitors?: string;
  stage?: string;
}

interface ProjectContextEditorProps {
  projectId: string;
}

export default function ProjectContextEditor({ projectId }: ProjectContextEditorProps) {
  const [context, setContext] = useState<ProjectContext>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 自动撑高 textarea 的回调 ref
  const autoResizeRefFn = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const adjust = () => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    };
    adjust();
    el.addEventListener("input", adjust);
    return () => el.removeEventListener("input", adjust);
  }, []);

  // 加载项目上下文
  useEffect(() => {
    const loadContext = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/context`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.projectId) {
            setContext(data);
          }
        }
      } catch (err) {
        console.error("Failed to load context:", err);
      } finally {
        setLoading(false);
      }
    };
    loadContext();
  }, [projectId]);

  // 保存项目上下文
  const saveContext = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${projectId}/context`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
      if (res.ok) {
        const data = await res.json();
        setContext(data);
        setMessage("保存成功！Agent 现在可以使用这些信息了。");
      } else {
        setMessage("保存失败，请重试。");
      }
    } catch (err) {
      console.error("Failed to save context:", err);
      setMessage("保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-gray-800">项目上下文配置</h2>
      <p className="text-sm text-gray-500">
        填写以下信息，AI Agent 将基于这些上下文为你提供更精准的分析和建议。
      </p>

      {/* 行业 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">行业</label>
        <input
          type="text"
          value={context.industry || ""}
          onChange={(e) => setContext({ ...context, industry: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="例如：电商、教育、医疗、金融科技"
        />
      </div>

      {/* 目标用户 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">目标用户</label>
        <textarea
          value={context.targetAudience || ""}
          onChange={(e) => setContext({ ...context, targetAudience: e.target.value })}
          ref={autoResizeRefFn}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
          placeholder="描述你的目标用户群体，例如：中小企业主、Z世代消费者、技术爱好者..."
          rows={3}
        />
      </div>

      {/* 解决的问题 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">解决的问题（痛点）</label>
        <textarea
          value={context.problem || ""}
          onChange={(e) => setContext({ ...context, problem: e.target.value })}
          ref={autoResizeRefFn}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
          placeholder="你的项目要解决用户什么具体问题？"
          rows={3}
        />
      </div>

      {/* 价值主张 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">价值主张</label>
        <textarea
          value={context.valueProposition || ""}
          onChange={(e) => setContext({ ...context, valueProposition: e.target.value })}
          ref={autoResizeRefFn}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
          placeholder="你的项目为用户提供什么样的独特价值或好处？"
          rows={3}
        />
      </div>

      {/* 竞争对手 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">竞争对手</label>
        <textarea
          value={context.competitors || ""}
          onChange={(e) => setContext({ ...context, competitors: e.target.value })}
          ref={autoResizeRefFn}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
          placeholder="列出主要竞争对手，用逗号分隔"
          rows={2}
        />
      </div>

      {/* 项目阶段 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">项目阶段</label>
        <select
          value={context.stage || "idea"}
          onChange={(e) => setContext({ ...context, stage: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="idea">💡 想法阶段</option>
          <option value="validation">🔍 验证阶段</option>
          <option value="prototype">🛠 原型阶段</option>
          <option value="mvp">🚀 MVP阶段</option>
        </select>
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-4">
        <button
          onClick={saveContext}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? "保存中..." : "保存上下文"}
        </button>
        {message && (
          <span className={`text-sm ${message.includes("失败") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
