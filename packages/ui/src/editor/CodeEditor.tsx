"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import type { BeforeMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(async () => import("@monaco-editor/react").then((mod) => mod.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-80 animate-pulse flex-col gap-3 bg-card px-4 py-3">
      <div className="h-4 w-32 rounded-md bg-muted" />
      <div className="h-full rounded-lg bg-muted/60" />
    </div>
  ),
});

export interface CodeEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
}

export interface CodeEditorProps {
  language: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  fontSize?: number;
  readOnly?: boolean;
  className?: string;
  minHeight?: number;
}

type MonacoProps = ComponentProps<typeof MonacoEditor>;

/**
 * Maps language keys used throughout the app to the Monaco language IDs.
 * Monaco does NOT accept "python3", "nodejs", "c++", etc.
 * Using an unknown string causes Monaco to fall back to plaintext, which
 * still triggers the JS/TS validator on the previous model — this map
 * prevents that by always providing a clean, recognised language ID.
 */
const MONACO_LANGUAGE_MAP: Record<string, string> = {
  cpp: "cpp",
  "c++": "cpp",
  c: "c",
  python: "python",
  python3: "python",  // Judge0 uses "python3"; Monaco only knows "python"
  java: "java",
  javascript: "javascript",
  nodejs: "javascript",  // Judge0 "nodejs"; Monaco only knows "javascript"
  typescript: "typescript",
  kotlin: "kotlin",
  swift: "swift",
  ruby: "ruby",
};

/**
 * Disable all JS/TS built-in diagnostics BEFORE the editor mounts.
 * Without this, Monaco's TypeScript language service runs on EVERY model
 * regardless of the selected language, causing red squiggles on valid
 * Python / Java / C++ code.
 */
const handleEditorWillMount: BeforeMount = (monaco) => {
  // Kill semantic + syntax validation for both JS and TS workers
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });

  // Be lenient about what TS accepts so we don't block valid JS patterns
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    allowJs: true,
    noLib: true,
  });
};

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  {
    language,
    value,
    defaultValue = "",
    onChange,
    fontSize = 14,
    readOnly = false,
    className = "",
    minHeight = 400,
  },
  ref
) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => internalValue,
      setValue: (nextValue: string) => {
        setInternalValue(nextValue);
        onChange?.(nextValue);
      },
    }),
    [internalValue, onChange]
  );

  // Resolve to a Monaco-recognised language ID
  const monacoLanguage = MONACO_LANGUAGE_MAP[language] ?? language;

  // Python uses 4-space indentation; everything else uses 2
  const tabSize = monacoLanguage === "python" ? 4 : 2;

  const editorOptions = useMemo<NonNullable<MonacoProps["options"]>>(
    () => ({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      lineNumbers: "on",
      renderLineHighlight: "line",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      tabSize,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      readOnly,
    }),
    [readOnly, tabSize]
  );

  return (
    <div className={`h-full overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      <MonacoEditor
        height={typeof minHeight === "number" ? `${minHeight}px` : minHeight}
        defaultLanguage={monacoLanguage}
        language={monacoLanguage}
        theme="vs-dark"
        value={internalValue}
        beforeMount={handleEditorWillMount}
        onChange={(nextValue) => {
          const resolved = nextValue ?? "";
          setInternalValue(resolved);
          onChange?.(resolved);
        }}
        options={{
          ...editorOptions,
          fontSize,
        }}
      />
    </div>
  );
});
