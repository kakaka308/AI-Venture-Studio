"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      params.then(({ id }) => {
        fetch(`/api/projects/${id}`)
          .then((res) => res.json())
          .then((data) => {
            setProject(data);
            setName(data.name);
            setDescription(data.description || "");
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
    }
  }, [session, params]);

  async function handleSave() {
    const { id } = await params;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
      setIsEditing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定要删除这个项目吗？")) return;
    
    const { id } = await params;
    const res = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/dashboard");
    }
  }

  if (loading) return <div className="p-8">加载中...</div>;
  if (!project) return <div className="p-8">项目不存在</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-blue-600 mb-4"
        >
          ← 返回 Dashboard
        </button>

        <div className="bg-white p-8 rounded-lg shadow">
          {isEditing ? (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-3xl font-bold border-b-2 mb-4 p-2"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border p-2 rounded mb-4"
                rows={6}
              />
              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  保存
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="border px-4 py-2 rounded"
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold">{project.name}</h1>
                  <p className="text-gray-500 text-sm mt-2">
                    创建于 {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    编辑
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded"
                  >
                    删除
                  </button>
                </div>
              </div>
              <p className="text-gray-700">
                {project.description || "暂无描述"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
