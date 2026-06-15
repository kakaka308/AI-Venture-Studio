"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import type { Components } from "react-markdown";

interface MessageBubbleProps {
  message: UIMessage | { id?: string; role: string; content: string };
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Extract text content: AI SDK v6 uses parts[], DB messages use content string
  const textContent = useMemo(() => {
    if ("parts" in message && Array.isArray(message.parts)) {
      return message.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { type: "text"; text: string }).text)
        .join("");
    }
    return (message as { content?: string }).content ?? "";
  }, [message]);

  // Shared markdown components for light + dark mode
  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 className="text-lg font-bold mt-3 mb-2 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-bold mt-3 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h3>
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
          <code
            className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <pre className="mt-2 mb-2 p-3 rounded-lg bg-gray-800 dark:bg-gray-900 text-gray-100 text-xs overflow-x-auto font-mono">
          <code className={className} {...props}>
            {children}
          </code>
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-600 underline"
      >
        {children}
      </a>
    ),
  };

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar - only for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm [&_a]:text-blue-200 [&_code]:bg-blue-700/50 [&_pre]:bg-blue-700/50 [&_strong]:text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          // User messages: plain text with line breaks
          <p className="whitespace-pre-wrap">{textContent}</p>
        ) : (
          // Assistant messages: full markdown rendering
          <ReactMarkdown components={markdownComponents}>
            {textContent}
          </ReactMarkdown>
        )}
      </div>

      {/* Avatar - only for user */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-600 dark:text-gray-300"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}
