"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/projects")
        .then((res) => res.json())
        .then(setProjects);
    }
  }, [session]);

  if (status === "loading") {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-blue-600 mb-4"
        >
          ← 返回 Dashboard
        </button>
        <h1 className="text-3xl font-bold mb-6">所有项目</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="bg-white p-6 rounded-lg shadow hover:shadow-md cursor-pointer"
            >
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <p className="text-gray-600 text-sm">
                {project.description || "暂无描述"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
