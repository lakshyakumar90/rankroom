export type CompareMode =
  | "EXACT"
  | "UNORDERED"
  | "FLOAT_TOLERANCE"
  | "IGNORE_TRAILING_WHITESPACE";

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function normalizeWhitespace(value: string): string {
  return normalizeLineEndings(value)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .filter(Boolean);
}

export function compareOutput(
  stdout: string,
  expected: string,
  mode: CompareMode,
  epsilon = 1e-6
): boolean {
  const actual = normalizeWhitespace(stdout);
  const wanted = normalizeWhitespace(expected);

  switch (mode) {
    case "EXACT":
    case "IGNORE_TRAILING_WHITESPACE":
      return actual === wanted;
    case "UNORDERED": {
      const actualTokens = tokenize(actual).sort();
      const expectedTokens = tokenize(wanted).sort();
      return JSON.stringify(actualTokens) === JSON.stringify(expectedTokens);
    }
    case "FLOAT_TOLERANCE": {
      const actualTokens = tokenize(actual);
      const expectedTokens = tokenize(wanted);
      if (actualTokens.length !== expectedTokens.length) return false;

      for (let i = 0; i < actualTokens.length; i++) {
        const left = Number(actualTokens[i]);
        const right = Number(expectedTokens[i]);

        if (Number.isNaN(left) || Number.isNaN(right)) {
          if (actualTokens[i] !== expectedTokens[i]) return false;
          continue;
        }

        if (Math.abs(left - right) > epsilon) return false;
      }

      return true;
    }
    default:
      return actual === wanted;
  }
}
