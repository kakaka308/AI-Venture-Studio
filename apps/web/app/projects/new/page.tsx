"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function NewProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading") return <div className="p-8">加载中...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, industry, targetAudience }),
    });

    if (res.ok) {
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } else {
      const data = await res.json();
      setError(data.error || "创建失败");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-96 bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">新建项目</h1>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">项目名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">项目描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border p-2 rounded"
            rows={4}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">行业</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="例如：电商、教育、医疗"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">目标用户</label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="描述你的目标用户群体"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex-1 border p-2 rounded"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white p-2 rounded disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建"}
          </button>
        </div>
      </form>
    </div>
  );
}
