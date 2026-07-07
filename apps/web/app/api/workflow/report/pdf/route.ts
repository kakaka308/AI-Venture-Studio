import { NextRequest } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { marked } from "marked";

// 启动或复用浏览器实例（避免每次请求都重新启动）
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
}

// 全局清理（进程退出时关闭浏览器）
if (typeof process !== "undefined") {
  ["SIGTERM", "SIGINT", "beforeExit"].forEach((signal) => {
    process.on(signal, async () => {
      if (browserPromise) {
        const browser = await browserPromise;
        await browser.close();
        browserPromise = null;
      }
    });
  });
}

/**
 * 生成打印友好的 HTML 模板
 * 样式与 WorkflowReportCard 的视觉呈现保持一致
 */
function buildReportHtml(
  bodyHtml: string,
  title: string
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif;
    font-size: 14px;
    line-height: 1.75;
    color: #1a1a1a;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- 报告标题 ---- */
  .report-header {
    border-bottom: 3px solid #10b981;
    padding-bottom: 16px;
    margin-bottom: 28px;
  }
  .report-header h1 {
    font-size: 26px;
    font-weight: 800;
    color: #064e3b;
    letter-spacing: -0.02em;
  }
  .report-header .meta {
    margin-top: 6px;
    font-size: 12px;
    color: #6b7280;
  }

  /* ---- 标题层级 ---- */
  h2 {
    font-size: 19px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 32px;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1.5px solid #e5e7eb;
  }
  h3 {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  h4 {
    font-size: 14px;
    font-weight: 700;
    color: #334155;
    margin-top: 20px;
    margin-bottom: 6px;
  }

  /* ---- 段落 ---- */
  p {
    margin: 8px 0;
  }

  /* ---- 列表 ---- */
  ul, ol {
    margin: 10px 0;
    padding-left: 24px;
  }
  ul { list-style-type: disc; }
  ol { list-style-type: decimal; }
  li {
    margin-bottom: 4px;
  }
  li > p {
    margin: 2px 0;
  }

  /* ---- 强调 ---- */
  strong { font-weight: 700; color: #0f172a; }
  em { font-style: italic; }

  /* ---- 行内代码 ---- */
  code {
    font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
    font-size: 12.5px;
    background: #f1f5f9;
    color: #be123c;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* ---- 代码块 ---- */
  pre {
    margin: 13px 0;
    padding: 14px 16px;
    background: #1e293b;
    color: #e2e8f0;
    border-radius: 8px;
    font-size: 12.5px;
    line-height: 1.6;
    overflow-x: auto;
  }
  pre code {
    background: none;
    color: inherit;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
  }

  /* ---- 引用块 ---- */
  blockquote {
    margin: 13px 0;
    padding: 10px 16px;
    border-left: 4px solid #60a5fa;
    background: #f0f9ff;
    color: #475569;
    font-style: italic;
    border-radius: 0 6px 6px 0;
  }
  blockquote p {
    margin: 4px 0;
  }

  /* ---- 分割线 ---- */
  hr {
    margin: 24px 0;
    border: none;
    border-top: 1.5px solid #e5e7eb;
  }

  /* ---- 链接 ---- */
  a {
    color: #2563eb;
    text-decoration: underline;
  }

  /* ---- 表格 ---- */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13px;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f8fafc;
    font-weight: 700;
    color: #1e293b;
  }
  tr:nth-child(even) td {
    background: #fafbfc;
  }

  /* ---- 图片 ---- */
  img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 12px 0;
  }

  /* ---- 页脚 ---- */
  .report-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1.5px solid #e5e7eb;
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
  }

  /* ---- 分页控制 ---- */
  h2 { page-break-before: auto; }
  h2:not(:first-of-type) { page-break-before: auto; }
  h2 + * { page-break-after: avoid; }

  @media print {
    body { font-size: 12px; }
    h2 { font-size: 17px; }
    h3 { font-size: 14px; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  }
</style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">生成时间：${new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  ${bodyHtml}

  <div class="report-footer">
    AI Venture Studio · Multi-Agent 协作分析 · 本报告由 AI 自动生成，仅供参考
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: NextRequest) {
  try {
    const { content, projectName } = await req.json();

    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "缺少报告内容 (content)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const title = projectName
      ? `${projectName} - Multi-Agent 分析报告`
      : "Multi-Agent 分析报告";

    // Markdown → HTML
    const bodyHtml = await marked.parse(content, {
      breaks: true,
      gfm: true,
    });

    const html = buildReportHtml(bodyHtml, title);

    // Puppeteer 渲染 PDF
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
        printBackground: true,
        preferCSSPageSize: true,
      });

      const safeFilename = encodeURIComponent(
        `Multi-Agent_分析报告_${new Date().toISOString().slice(0, 10)}.pdf`
      );

      return new Response(Buffer.from(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
          "Cache-Control": "no-cache",
        },
      });
    } finally {
      await page.close();
    }
  } catch (err) {
    console.error("[PDF] 生成失败:", err);
    return new Response(
      JSON.stringify({
        error: "PDF 生成失败",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
