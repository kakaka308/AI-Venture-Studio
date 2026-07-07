"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
import { Download } from "lucide-react";

interface MermaidRendererProps {
  code: string;
}

export default function MermaidRenderer({ code }: MermaidRendererProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  // useId() 保证 SSR 一致性 + 无随机数计算开销；存入 ref 确保首次渲染后永不变化
  // 去掉冒号（:）避免 Mermaid 内部 DOM 选择器问题
  const idRef = useRef(`mermaid-${reactId.replace(/:/g, "")}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        // 使用 parse + render 避免 DOM 污染
        await mermaid.parse(code);
        const { svg: renderedSvg } = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Mermaid 图表渲染失败";
          setError(msg);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [code]);

  // 下载 SVG
  const downloadSvg = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ER图_${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  // 下载 PNG（SVG → Canvas → PNG）
  const downloadPng = useCallback(() => {
    if (!svg) return;

    // 解析 SVG 获取 viewBox/宽高
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return;

    const viewBox = svgEl.getAttribute("viewBox");
    let w = 0,
      h = 0;
    if (viewBox) {
      const parts = viewBox.split(/\s+/);
      w = parseFloat(parts[2]) || 800;
      h = parseFloat(parts[3]) || 600;
    } else {
      w = parseFloat(svgEl.getAttribute("width") || "800");
      h = parseFloat(svgEl.getAttribute("height") || "600");
    }

    // 2x 缩放提高清晰度
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const downloadUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `ER图_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      }, "image/png");
    };

    img.src = url;
  }, [svg]);

  if (error) {
    return (
      <div className="mt-2 mb-2 border border-red-300 dark:border-red-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">
            ER 图
          </span>
          <span className="text-[10px] text-red-400">渲染失败</span>
        </div>
        <div className="px-3 py-2">
          <p className="text-xs text-red-500 font-mono">{error}</p>
          <pre className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300 overflow-x-auto font-mono">
            {code}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-2 border border-blue-300 dark:border-blue-700 rounded-lg overflow-hidden">
      {/* 标题栏 + 导出按钮 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">
          ER 图
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={downloadSvg}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
            title="下载 SVG"
          >
            <Download className="w-3 h-3" />
            SVG
          </button>
          <button
            onClick={downloadPng}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
            title="下载 PNG"
          >
            <Download className="w-3 h-3" />
            PNG
          </button>
        </div>
      </div>

      {/* SVG 渲染区域 */}
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-900 p-3 flex justify-center overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg ?? "" }}
      />

      {/* 底部：展示源代码 */}
      <details className="border-t border-blue-200 dark:border-blue-800">
        <summary className="px-3 py-1 text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 cursor-pointer select-none">
          查看 Mermaid 源码
        </summary>
        <pre className="px-3 pb-2 text-[10px] text-gray-500 dark:text-gray-400 overflow-x-auto font-mono whitespace-pre">
          {code}
        </pre>
      </details>
    </div>
  );
}
