/**
 * Markdown 内容预处理：修复 Agent 输出中 react-markdown 无法正确渲染的内容。
 *
 * 处理场景：
 * 1. Unicode 制表符（─│├└ 等）——被 Markdown 解析器误解为表格/分隔线，需要包裹为代码块
 * 2. 其他未来可能需要的预处理
 */

/** Unicode 制表符（Box Drawing 区块） */
const BOX_DRAWING_RE =
  /[─━│┃┄┅┆┇┈┉┊┋┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋╌╍╎╏═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬]/;

/**
 * 预处理 Markdown 文本，将含 Unicode 制表符的 ASCII 排版行包裹为代码块，
 * 防止 react-markdown 将其误解为表格语法。
 */
export function preprocessMarkdown(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let i = 0;
  let inCodeFence = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ---- 跟踪已有的 ``` 代码块状态，不处理内部内容 ----
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      out.push(line);
      i++;
      continue;
    }

    if (inCodeFence) {
      out.push(line);
      i++;
      continue;
    }

    // ---- 检测 Unicode 制表符行 → 包裹为 ```text 代码块 ----
    if (BOX_DRAWING_RE.test(line)) {
      out.push("```text");
      while (
        i < lines.length &&
        BOX_DRAWING_RE.test(lines[i]) &&
        !lines[i].trim().startsWith("```")
      ) {
        out.push(lines[i]);
        i++;
      }
      out.push("```");
    } else {
      out.push(line);
      i++;
    }
  }

  // 如果 ``` 没闭合，补一个
  if (inCodeFence) {
    out.push("```");
  }

  return out.join("\n");
}
