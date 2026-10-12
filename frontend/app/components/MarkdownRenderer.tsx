"use client";

import React from "react";

type MarkdownRendererProps = {
  content: string;
  isUser?: boolean;
};

/**
 * Parses inline tokens: **bold**, `code`, etc.
 */
function parseInline(text: string, isUser: boolean): React.ReactNode[] {
  // Regex to match **bold** or `code`
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={index}
          className={
            isUser
              ? "font-bold text-white tracking-wide"
              : "font-bold text-[#192A56] tracking-tight"
          }
        >
          {inner}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`rounded px-1.5 py-0.5 font-mono text-xs ${
            isUser
              ? "bg-white/20 text-white"
              : "bg-[#192A56]/10 text-[#192A56]"
          }`}
        >
          {inner}
        </code>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: { num: string; text: string }[] }
  | { type: "paragraph"; lines: string[] };

/**
 * Parse text into structured markdown blocks
 */
function parseBlocks(markdown: string): Block[] {
  const rawLines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];

  let currentUl: string[] | null = null;
  let currentOl: { num: string; text: string }[] | null = null;
  let currentPara: string[] | null = null;

  const flushLists = () => {
    if (currentUl) {
      blocks.push({ type: "ul", items: currentUl });
      currentUl = null;
    }
    if (currentOl) {
      blocks.push({ type: "ol", items: currentOl });
      currentOl = null;
    }
  };

  const flushPara = () => {
    if (currentPara && currentPara.length > 0) {
      blocks.push({ type: "paragraph", lines: currentPara });
      currentPara = null;
    }
  };

  for (const line of rawLines) {
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      flushLists();
      flushPara();
      continue;
    }

    // Heading (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushLists();
      flushPara();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    // Bullet point (- or *)
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
    if (bulletMatch) {
      flushPara();
      if (currentOl) {
        blocks.push({ type: "ol", items: currentOl });
        currentOl = null;
      }
      if (!currentUl) currentUl = [];
      currentUl.push(bulletMatch[1]);
      continue;
    }

    // Numbered list (e.g. 1. text)
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      flushPara();
      if (currentUl) {
        blocks.push({ type: "ul", items: currentUl });
        currentUl = null;
      }
      if (!currentOl) currentOl = [];
      currentOl.push({ num: numberedMatch[1], text: numberedMatch[2] });
      continue;
    }

    // Regular line in paragraph
    flushLists();
    if (!currentPara) currentPara = [];
    currentPara.push(line);
  }

  flushLists();
  flushPara();

  return blocks;
}

export default function MarkdownRenderer({
  content,
  isUser = false,
}: MarkdownRendererProps) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  return (
    <div
      className={`markdown-body space-y-3 text-sm leading-relaxed ${
        isUser ? "text-white" : "text-[#192A56]/90"
      }`}
    >
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          const Tag = (
            block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4"
          ) as "h2" | "h3" | "h4";

          const sizeClass =
            block.level === 1
              ? "text-base font-bold sm:text-lg"
              : block.level === 2
              ? "text-sm font-bold sm:text-base"
              : "text-xs font-semibold sm:text-sm uppercase tracking-wider";

          return (
            <Tag
              key={idx}
              className={`mt-4 mb-2 first:mt-0 ${sizeClass} ${
                isUser ? "text-white" : "text-[#192A56]"
              }`}
            >
              {parseInline(block.text, isUser)}
            </Tag>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={idx} className="my-2 space-y-2 pl-0.5">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5">
                  <span
                    className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                      isUser ? "bg-white/80" : "bg-[#192A56]/70"
                    }`}
                  />
                  <div className="flex-1">
                    {parseInline(item, isUser)}
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={idx} className="my-2 space-y-2 pl-0.5">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      isUser
                        ? "bg-white/20 text-white"
                        : "bg-[#192A56]/10 text-[#192A56]"
                    }`}
                  >
                    {item.num}
                  </span>
                  <div className="flex-1 pt-0.5">
                    {parseInline(item.text, isUser)}
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={idx} className="leading-6">
              {block.lines.map((line, lineIdx) => (
                <React.Fragment key={lineIdx}>
                  {parseInline(line, isUser)}
                  {lineIdx < block.lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
