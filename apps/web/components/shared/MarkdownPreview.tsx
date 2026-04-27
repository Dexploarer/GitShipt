import * as React from "react";

interface MarkdownPreviewProps {
  markdown: string;
  emptyLabel?: string;
}

type Block =
  | { kind: "heading"; level: 2 | 3; text: string; key: string }
  | { kind: "paragraph"; text: string; key: string }
  | { kind: "list"; items: string[]; key: string }
  | { kind: "code"; text: string; key: string };

export function MarkdownPreview({
  markdown,
  emptyLabel = "Nothing published yet.",
}: MarkdownPreviewProps) {
  const blocks = parseMarkdown(markdown);
  if (blocks.length === 0) {
    return <p className="text-body-sm text-fg-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-body-md text-fg-secondary">
      {blocks.map((block) => {
        if (block.kind === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={block.key}
              className={
                block.level === 2
                  ? "mt-2 text-headline-md text-fg"
                  : "mt-1 text-headline-sm text-fg"
              }
            >
              {block.text}
            </Tag>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={block.key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, index) => (
                <li key={`${block.key}-${index}`}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "code") {
          return (
            <pre
              key={block.key}
              className="overflow-x-auto rounded-md border border-border bg-surface px-4 py-3 text-mono-sm text-fg"
            >
              {block.text}
            </pre>
          );
        }
        return <p key={block.key}>{block.text}</p>;
      })}
    </div>
  );
}

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({
      kind: "paragraph",
      text: paragraph.join(" "),
      key: `p-${blocks.length}`,
    });
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    blocks.push({ kind: "list", items: list, key: `l-${blocks.length}` });
    list = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === "```") {
      if (code) {
        blocks.push({
          kind: "code",
          text: code.join("\n"),
          key: `c-${blocks.length}`,
        });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(rawLine);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: 3,
        text: line.slice(4).trim(),
        key: `h-${blocks.length}`,
      });
      continue;
    }

    if (line.startsWith("## ") || line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: 2,
        text: line.replace(/^#{1,2}\s+/, "").trim(),
        key: `h-${blocks.length}`,
      });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  if (code && code.length > 0) {
    blocks.push({
      kind: "code",
      text: code.join("\n"),
      key: `c-${blocks.length}`,
    });
  }
  return blocks;
}
