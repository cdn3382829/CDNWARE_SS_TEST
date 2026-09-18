import type { ReactNode } from "react";

/**
 * Minimal, XSS-safe rich text renderer.
 *
 * User content is never injected as HTML. Everything is tokenised into React
 * elements, so `<script>` or `onerror=` payloads render as literal text.
 *
 * Supported syntax:
 *   **bold**  *italic*  __underline__  ~~strike~~
 *   `inline code`
 *   ``` fenced code block ```
 *   [img]https://...[/img] or [img]<image id>[/img]
 *   https://auto.linked.urls
 */

const INLINE = /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(`[^`\n]+`)|(\[img\][^\[\n]{1,400}\[\/img\])|(https?:\/\/[^\s<>"']+)/g;

function safeImageSource(raw: string): string | null {
  const value = raw.trim();
  if (/^[a-f0-9]{8,32}$/.test(value)) return `/api/images/${value}`;
  if (/^https:\/\/[\w.-]+\/[\w\-./%?=&#]*$/.test(value)) return value;
  return null;
}

function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(line)) !== null) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    index += 1;
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("__")) {
      nodes.push(
        <u key={key} className="underline decoration-[#ff3b3b] decoration-2 underline-offset-2">
          {token.slice(2, -2)}
        </u>,
      );
    } else if (token.startsWith("~~")) {
      nodes.push(
        <s key={key} className="text-zinc-500">
          {token.slice(2, -2)}
        </s>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-[#16161a] px-1.5 py-0.5 font-mono text-[0.82em] text-[#ff6b6b]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[img]")) {
      const src = safeImageSource(token.slice(5, -6));
      if (src) {
        nodes.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key}
            src={src}
            alt="user attachment"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="my-2 max-h-[420px] max-w-full rounded-lg border border-[#26262c] object-contain"
          />,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("http")) {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="text-[#ff5a5a] underline decoration-[#ff5a5a]/40 underline-offset-2 hover:decoration-[#ff5a5a]"
        >
          {token}
        </a>,
      );
    } else {
      nodes.push(
        <em key={key} className="italic text-zinc-200">
          {token.slice(1, -1)}
        </em>,
      );
    }
    cursor = match.index + token.length;
  }
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

export function renderMarkup(source: string): ReactNode {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let buffer: string[] = [];
  let inFence = false;

  const flushParagraph = (key: string) => {
    if (buffer.length === 0) return;
    blocks.push(
      <p key={key} className="whitespace-pre-wrap break-words leading-relaxed text-zinc-300">
        {buffer.map((line, i) => (
          <span key={`${key}-${i}`}>{renderInline(line, `${key}-${i}`)}</span>
        ))}
      </p>,
    );
    buffer = [];
  };

  lines.forEach((line, i) => {
    if (line.trimStart().startsWith("```")) {
      if (inFence) {
        blocks.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-x-auto rounded-lg border border-[#26262c] bg-[#0d0d10] p-3 font-mono text-[12px] leading-relaxed text-[#d7d7dc]"
          >
            <code>{buffer.join("\n")}</code>
          </pre>,
        );
        buffer = [];
        inFence = false;
      } else {
        flushParagraph(`p-${i}`);
        inFence = true;
      }
      return;
    }
    if (inFence) {
      buffer.push(line);
      return;
    }
    if (line.trim() === "") {
      flushParagraph(`p-${i}`);
      return;
    }
    buffer.push(line);
  });

  if (inFence && buffer.length > 0) {
    blocks.push(
      <pre
        key="code-tail"
        className="my-2 overflow-x-auto rounded-lg border border-[#26262c] bg-[#0d0d10] p-3 font-mono text-[12px] leading-relaxed text-[#d7d7dc]"
      >
        <code>{buffer.join("\n")}</code>
      </pre>,
    );
  } else {
    flushParagraph("p-tail");
  }

  return <div className="space-y-1.5 text-[14px]">{blocks}</div>;
}
