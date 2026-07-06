"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface WorkflowReportCardProps {
  content: string;
}

export default function WorkflowReportCard({ content }: WorkflowReportCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  // 下载为 Markdown 文件
  const downloadMarkdown = useCallback(() => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Multi-Agent_分析报告_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  // 打印为 PDF（利用浏览器打印功能）
  const downloadPdf = useCallback(() => {
    window.print();
  }, []);

  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 className="text-xl font-bold mt-4 mb-3 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-bold mt-3 mb-1.5">{children}</h3>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="text-sm">{children}</li>,
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="mt-2 mb-2 p-3 rounded-lg bg-gray-800 dark:bg-gray-900 text-gray-100 text-xs overflow-x-auto font-mono">
          <code className={className} {...props}>{children}</code>
        </pre>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-blue-400 pl-3 my-2 text-gray-600 dark:text-gray-400 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-gray-300 dark:border-gray-700" />,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline">
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-gray-300 dark:border-gray-700 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 font-semibold text-left">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-300 dark:border-gray-700 px-3 py-1.5">{children}</td>
    ),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 print:max-w-none print:px-0">
      <div className="flex gap-3 items-start print:block">
        {/* 头像 - 打印时隐藏 */}
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center shrink-0 print:hidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        {/* 报告卡片 */}
        <div className="flex-1 rounded-2xl rounded-tl-sm bg-linear-to-br from-green-50 to-teal-50 dark:from-green-950/40 dark:to-teal-950/40 border border-green-200 dark:border-green-800 overflow-hidden print:rounded-none print:border-0 print:bg-white dark:print:bg-white">
          {/* 头部 */}
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-green-200/50 dark:border-green-800/50 print:border-gray-300">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 print:text-black">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-sm font-semibold text-green-700 dark:text-green-300 print:text-black">
                Multi-Agent 分析报告
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* 下载按钮组 - 打印时隐藏 */}
              <div className="flex items-center gap-0.5 print:hidden">
                <button
                  onClick={downloadMarkdown}
                  title="下载 Markdown"
                  className="text-green-500 hover:text-green-700 hover:bg-green-100 dark:hover:text-green-300 dark:hover:bg-green-900/30 transition-colors p-1 rounded"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                <button
                  onClick={downloadPdf}
                  title="打印为 PDF"
                  className="text-green-500 hover:text-green-700 hover:bg-green-100 dark:hover:text-green-300 dark:hover:bg-green-900/30 transition-colors p-1 rounded"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9V2h12v7" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </button>
              </div>
              {/* 折叠按钮 */}
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="text-green-500 hover:text-green-700 dark:hover:text-green-300 transition-colors p-1 print:hidden"
              >
                {collapsed ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* 报告正文 */}
          {!collapsed && (
            <div className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 leading-relaxed print:text-black print:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
