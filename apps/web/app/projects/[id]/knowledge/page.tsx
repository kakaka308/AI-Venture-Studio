"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface KnowledgeDoc {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunksCount: number;
  createdAt: string;
}

const FILE_TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pdf: { label: "PDF", color: "bg-red-100 text-red-700", icon: "📄" },
  markdown: { label: "Markdown", color: "bg-purple-100 text-purple-700", icon: "📝" },
  txt: { label: "TXT", color: "bg-gray-100 text-gray-700", icon: "📃" },
};

const SUPPORTED_TYPES = [
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/x-markdown",
];
const SUPPORTED_EXTS = [".pdf", ".md", ".markdown", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchDocuments = useCallback(() => {
    if (session?.user && id) {
      fetch(`/api/projects/${id}/knowledge`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          return res.json();
        })
        .then((data) => {
          setDocuments(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session, id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const validateAndUpload = async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_TYPES.includes(file.type) && !SUPPORTED_EXTS.includes(ext)) {
      alert("仅支持 PDF、Markdown、TXT 格式文件");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("文件大小不能超过 10MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", id);

      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchDocuments();
      } else {
        const err = await res.json();
        alert(err.error || "上传失败");
      }
    } catch {
      alert("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    // 重置 input，允许重复上传同名文件
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndUpload(file);
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("确定要删除此文件吗？文件内容将一并移除。")) return;
    setDeletingId(documentId);
    try {
      const res = await fetch(
        `/api/projects/${id}/knowledge?documentId=${documentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchDocuments();
      } else {
        const err = await res.json();
        alert(err.error || "删除失败");
      }
    } catch {
      alert("删除失败，请重试");
    } finally {
      setDeletingId(null);
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
              <h1 className="text-xl font-bold">知识库</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <p className="text-sm text-gray-500">
          上传 PDF、Markdown、TXT 文件，AI 将自动分析文件内容并用于项目对话。
        </p>

        {/* 上传区域 */}
        <div
          className={`bg-white rounded-lg shadow p-6 text-center transition-colors ${
            dragOver ? "border-2 border-teal-400 bg-teal-50" : "border-2 border-dashed border-gray-300"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center py-4">
            <svg
              className="w-10 h-10 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-600 mb-1">
              <span
                className="text-teal-600 font-medium cursor-pointer hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                点击上传
              </span>{" "}
              或拖拽文件到此处
            </p>
            <p className="text-xs text-gray-400">
              支持 PDF、Markdown、TXT，最大 10MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.md,.markdown,.txt"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading && (
            <p className="text-sm text-teal-600 mt-2">上传解析中，请稍候...</p>
          )}
        </div>

        {/* 已上传文件列表 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            已上传文件
            {documents.length > 0 && (
              <span className="text-sm text-gray-400 font-normal ml-2">
                ({documents.length})
              </span>
            )}
          </h2>

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">暂无上传的文件</p>
              <p className="text-gray-400 text-sm mt-1">
                上传 PDF、Markdown 或 TXT 文件开始构建知识库
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const typeInfo = FILE_TYPE_MAP[doc.fileType] || FILE_TYPE_MAP.txt;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">{typeInfo.icon}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {doc.fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatFileSize(doc.fileSize)}
                          </span>
                          {doc.chunksCount > 0 && (
                            <span className="text-xs text-gray-400">
                              {doc.chunksCount} 个分块
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0 ml-4 disabled:opacity-50"
                      title="删除"
                    >
                      {deletingId === doc.id ? "删除中..." : "✕"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
