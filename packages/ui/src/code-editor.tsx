"use client";

import { useRef, useCallback, type KeyboardEvent, type JSX } from "react";

export interface Language {
  id: string;
  name: string;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  onLanguageChange?: (language: string) => void;
  languages?: readonly Language[];
  className?: string;
  readOnly?: boolean;
  minHeight?: number;
  placeholder?: string;
}

/**
 * A lightweight code editor built on a plain <textarea>.
 * Supports line numbers, tab indentation, and a language selector.
 * Intentionally avoids heavy dependencies like Monaco or CodeMirror.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  languages,
  className = "",
  readOnly = false,
  minHeight = 400,
  placeholder = "// Write your code here…",
}: CodeEditorProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lines = value.split("\n");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;

      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;

      // Tab → insert 2 spaces
      if (e.key === "Tab") {
        e.preventDefault();
        const indent = "  ";
        const next = value.substring(0, start) + indent + value.substring(end);
        onChange(next);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + indent.length;
            textareaRef.current.selectionEnd = start + indent.length;
          }
        });
        return;
      }

      // Enter → auto-indent to match current line indent
      if (e.key === "Enter") {
        e.preventDefault();
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        const indent = currentLine.match(/^[ \t]*/)?.[0] ?? "";
        const insertion = "\n" + indent;
        const next = value.substring(0, start) + insertion + value.substring(end);
        onChange(next);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const pos = start + insertion.length;
            textareaRef.current.selectionStart = pos;
            textareaRef.current.selectionEnd = pos;
          }
        });
        return;
      }

      // Bracket auto-close
      const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]", '"': '"', "'": "'" };
      if (pairs[e.key] && start === end) {
        e.preventDefault();
        const open = e.key;
        const close = pairs[open]!;
        const next =
          value.substring(0, start) + open + close + value.substring(end);
        onChange(next);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + 1;
            textareaRef.current.selectionEnd = start + 1;
          }
        });
      }
    },
    [value, onChange, readOnly]
  );

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 font-mono text-sm ${className}`}
    >
      {/* Toolbar */}
      {languages && onLanguageChange && (
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-zinc-500">
            {lines.length} line{lines.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Editor area */}
      <div
        className="relative flex flex-1 overflow-auto"
        style={{ minHeight }}
      >
        {/* Line numbers */}
        <div
          aria-hidden="true"
          className="select-none border-r border-zinc-800 bg-zinc-950 px-3 py-4 text-right text-zinc-600"
          style={{ minWidth: "3.25rem" }}
        >
          {lines.map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent p-4 text-zinc-100 caret-violet-400 focus:outline-none leading-6 placeholder:text-zinc-600"
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
}
