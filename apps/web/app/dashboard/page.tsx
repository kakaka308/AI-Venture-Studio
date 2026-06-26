"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/projects")
        .then((res) => res.json())
        .then((data) => {
          setProjects(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  if (status === "loading" || loading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">AI Venture Studio</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">{session?.user?.email}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-red-600 hover:text-red-800"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 通用 AI 聊天入口 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-purple-700">通用 AI 创业助手</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  不归属任何项目，通用创业问题咨询与头脑风暴
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/chat")}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm flex-shrink-0"
            >
              开始聊天
            </button>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">我的项目</h2>
            <button
              onClick={() => router.push("/projects/new")}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              新建项目
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500"> 还没有项目，点击新建开始吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="bg-white p-6 rounded-lg shadow hover:shadow-md cursor-pointer"
                >
                  <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {project.description || "暂无描述"}
                  </p>
                  <p className="text-gray-400 text-xs">
                    更新于 {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
