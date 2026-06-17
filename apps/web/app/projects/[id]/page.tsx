"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProjectContextEditor from "@/components/project/ProjectContextEditor";
import TaskList from "@/components/project/TaskList";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  targetAudience: string | null;
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
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

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
            setIndustry(data.industry || "");
            setTargetAudience(data.targetAudience || "");
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
      body: JSON.stringify({ name, description, industry, targetAudience }),
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
    <div className="max-w-4xl mx-auto">
      {/* 1. 基本信息 */}
      <section id="overview" className="scroll-mt-24">
        <div className="bg-white p-8 rounded-lg shadow">
          {isEditing ? (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-3xl font-bold border-b-2 mb-4 p-2"
                placeholder="项目名称"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border p-2 rounded mb-4"
                rows={4}
                placeholder="项目描述"
              />
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full border p-2 rounded mb-4"
                placeholder="行业（例如：电商、教育、医疗）"
              />
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full border p-2 rounded mb-4"
                placeholder="目标用户（例如：中小企业主、Z世代消费者）"
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
              <p className="text-gray-700 mb-4">
                {project.description || "暂无描述"}
              </p>
              <div className="flex gap-6 mb-4 text-sm">
                {project.industry && (
                  <div>
                    <span className="text-gray-400">行业：</span>
                    <span className="text-gray-700">{project.industry}</span>
                  </div>
                )}
                {project.targetAudience && (
                  <div>
                    <span className="text-gray-400">目标用户：</span>
                    <span className="text-gray-700">{project.targetAudience}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 2. 项目上下文配置 */}
      {!isEditing && (
        <section id="context" className="scroll-mt-24 mt-6">
          <div className="bg-white p-8 rounded-lg shadow">
            <ProjectContextEditor projectId={project.id} />
          </div>
        </section>
      )}

      {/* 3. 任务管理 */}
      {!isEditing && (
        <section id="tasks" className="scroll-mt-24 mt-6">
          <div className="bg-white p-8 rounded-lg shadow">
            <h2 className="text-lg font-bold mb-4">
              <span className="inline-flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="9" x2="15" y2="9" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="12" y2="17" />
                </svg>
                任务管理
              </span>
            </h2>
            <TaskList projectId={project.id} />
          </div>
        </section>
      )}

      {/* 4. 进入 AI Chat */}
      {!isEditing && (
        <section id="chat" className="scroll-mt-24 mt-6 text-center">
          <Link
            href={`/chat?projectId=${project.id}`}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            进入 AI 创业助手对话
          </Link>
        </section>
      )}
    </div>
  );
}
