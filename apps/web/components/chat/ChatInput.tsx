"use client";

import { useRef, useEffect } from "react";

interface ChatInputProps {
  input: string;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  disabled: boolean;
  /** 是否显示 Multi-Agent 分析按钮（仅项目上下文内显示） */
  showWorkflowButton?: boolean;
  /** 工作流正在运行中 */
  workflowRunning?: boolean;
  /** 触发工作流 */
  onRunWorkflow?: () => void;
}

export default function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  disabled,
  showWorkflowButton = false,
  workflowRunning = false,
  onRunWorkflow,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Submit on Enter (without Shift)
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading && !disabled && !workflowRunning) {
        const form = e.currentTarget.form;
        form?.requestSubmit();
      }
    }
  };

  const isBusy = isLoading || workflowRunning;

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
      {/* Multi-Agent 按钮行 */}
      {showWorkflowButton && (
        <div className="max-w-3xl mx-auto mb-2">
          <button
            type="button"
            onClick={onRunWorkflow}
            disabled={isBusy || disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              bg-linear-to-r from-purple-500 to-pink-500 text-white
              hover:from-purple-600 hover:to-pink-600
              disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-700
              disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {workflowRunning ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Multi-Agent 分析
              </>
            )}
          </button>
          <span className="ml-2 text-[10px] text-gray-400">
            自动依次运行市场分析→产品需求→架构设计→数据库→计划→风险评估→质量审查
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto flex items-end gap-3"
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder="Type your message..."
            disabled={disabled || workflowRunning}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 pr-12 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-colors"
          />
          {/* Character count hint */}
          <span className="absolute right-3 bottom-3 text-xs text-gray-400 dark:text-gray-600 pointer-events-none">
            {input.length > 500 && (
              <span className="text-amber-500">{input.length}</span>
            )}
          </span>
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isBusy || disabled}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          {isBusy ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>

      <p className="text-xs text-center mt-2 text-gray-400 dark:text-gray-600">
        AI Venture Studio can make mistakes. Please verify important
        information.
      </p>
    </div>
  );
}
