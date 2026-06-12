"use client";

import { useMemo } from "react";
import type { UIMessage } from "ai";

interface MessageBubbleProps {
  message: UIMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Extract text content from parts for rendering
  const textContent = useMemo(() => {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("");
  }, [message.parts]);

  // Simple markdown-like formatting: convert **bold**, *italic*, `code`, and newlines
  const formattedContent = useMemo(() => {
    // Split by code blocks (```)
    const parts = textContent.split(/(```[\s\S]*?```)/g);

    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        // Code block
        const code = part.slice(3, -3).replace(/^\w*\n?/, "");
        return (
          <pre
            key={i}
            className="mt-2 mb-2 p-3 rounded-lg bg-gray-800 dark:bg-gray-900 text-gray-100 text-xs overflow-x-auto font-mono"
          >
            <code>{code}</code>
          </pre>
        );
      }

      // Inline formatting
      const segments = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {segments.map((seg, j) => {
            if (seg.startsWith("`") && seg.endsWith("`")) {
              return (
                <code
                  key={j}
                  className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono"
                >
                  {seg.slice(1, -1)}
                </code>
              );
            }

            // Bold + italic + newline rendering
            const lines = seg.split("\n");
            return lines.map((line, k) => (
              <span key={k}>
                {k > 0 && <br />}
                {renderInlineFormatting(line)}
              </span>
            ));
          })}
        </span>
      );
    });
  }, [textContent]);

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
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        }`}
      >
        {formattedContent}
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

function renderInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
