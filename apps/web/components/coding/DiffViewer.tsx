"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

function diffLines(expectedLines: string[], actualLines: string[]) {
  const max = Math.max(expectedLines.length, actualLines.length);
  return Array.from({ length: max }, (_, index) => ({
    expected: expectedLines[index] ?? "",
    actual: actualLines[index] ?? "",
    changed: (expectedLines[index] ?? "") !== (actualLines[index] ?? ""),
  }));
}

function diffChars(expected: string, actual: string) {
  const max = Math.max(expected.length, actual.length);

  return Array.from({ length: max }, (_, index) => {
    const expectedChar = expected[index] ?? "";
    const actualChar = actual[index] ?? "";
    const changed = expectedChar !== actualChar;

    return {
      expected: expectedChar || " ",
      actual: actualChar || " ",
      changed,
    };
  });
}

export function DiffViewer({ expected, actual }: { expected: string; actual: string }) {
  const rows = diffLines(expected.split("\n"), actual.split("\n"));

  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-2">
          <pre className={cn("overflow-x-auto rounded-md p-2 text-xs", row.changed ? "bg-green-950/40" : "bg-muted/60")}>
            {row.changed ? (
              diffChars(row.expected, row.actual).map((part, partIndex) => (
                <Fragment key={partIndex}>
                  <span className={cn(part.changed && "rounded-sm bg-green-400/20")}>{part.expected}</span>
                </Fragment>
              ))
            ) : (
              row.expected || " "
            )}
          </pre>
          <pre className={cn("overflow-x-auto rounded-md p-2 text-xs", row.changed ? "bg-red-950/40" : "bg-muted/60")}>
            {row.changed ? (
              diffChars(row.expected, row.actual).map((part, partIndex) => (
                <Fragment key={partIndex}>
                  <span className={cn(part.changed && "rounded-sm bg-red-400/20")}>{part.actual}</span>
                </Fragment>
              ))
            ) : (
              row.actual || " "
            )}
          </pre>
        </div>
      ))}
    </div>
  );
}
