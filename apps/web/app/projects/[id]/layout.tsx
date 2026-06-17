"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Settings,
  ClipboardList,
  MessageSquare,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const SECTIONS = [
  { id: "overview", label: "基本信息", Icon: FileText },
  { id: "context", label: "项目上下文配置", Icon: Settings },
  { id: "tasks", label: "任务管理", Icon: ClipboardList },
  { id: "chat", label: "AI 创业助手", Icon: MessageSquare },
] as const;

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");

  // 滚动监听，高亮当前目录项
  useEffect(() => {
    const handleScroll = () => {
      let active: string = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          active = id;
        }
      }
      setActiveSection(active);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 点击目录项平滑滚动
  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 侧边目录导航 - 可折叠 */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-0"
        } transition-all duration-300 overflow-hidden border-r border-gray-200 bg-white sticky top-0 h-screen shrink-0 hidden lg:flex lg:flex-col`}
      >
        <div className="p-5 w-56 flex-1 flex flex-col min-h-0">
          {/* 目录标题 + 收起按钮 */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              页面目录
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="收起目录"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* 目录列表 - 可滚动 */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2.5 ${
                  activeSection === id
                    ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{label}</span>
                {activeSection === id && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-blue-600 shrink-0" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 min-w-0">
        {/* 顶部固定栏：返回按钮 + 展开目录按钮 */}
        <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-8 pt-4 pb-2">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="hidden lg:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow transition-all shrink-0"
                aria-label="展开目录"
              >
                <ChevronRight size={14} />
                目录
              </button>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0"
            >
              <ArrowLeft size={14} />
              返回 Dashboard
            </button>
          </div>

          {/* Mobile: 目录横向标签 */}
          <div className="lg:hidden mt-2 max-w-4xl mx-auto">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {SECTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeSection === id
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 子页面内容 */}
        <div className="px-8 pb-8">{children}</div>
      </main>
    </div>
  );
}
