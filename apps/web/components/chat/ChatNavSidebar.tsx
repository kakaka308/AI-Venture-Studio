"use client";

import { ChevronLeft, ChevronRight, MessageCircle, FileText } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  type: "question" | "report";
}

interface ChatNavSidebarProps {
  items: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (id: string) => void;
}

export default function ChatNavSidebar({
  items,
  collapsed,
  onToggle,
  onNavigate,
}: ChatNavSidebarProps) {
  return (
    <div
      className={`absolute right-0 top-0 h-full z-20 transition-all duration-300 ${
        collapsed ? "w-0" : "w-60"
      }`}
    >
      {/* Collapsed state: thin toggle strip on the right edge */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-20 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-l-lg flex items-center justify-center hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors group"
          title="展开导航"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </button>
      )}

      {/* Expanded state: full sidebar panel */}
      {!collapsed && (
        <div className="h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              页面导航
            </h3>
            <button
              onClick={onToggle}
              className="p-1 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
              title="收起导航"
            >
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          </div>

          {/* Navigation items */}
          <div className="overflow-y-auto h-[calc(100%-48px)] py-1">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                暂无内容
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors group flex items-start gap-2.5"
                >
                  <span className="shrink-0 mt-0.5">
                    {item.type === "report" ? (
                      <FileText className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                    )}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 leading-snug line-clamp-2">
                    {item.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
