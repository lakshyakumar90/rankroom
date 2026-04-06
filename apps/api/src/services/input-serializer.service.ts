export type SupportedParamType =
  | "int"
  | "long"
  | "float"
  | "double"
  | "string"
  | "bool"
  | "int[]"
  | "long[]"
  | "float[]"
  | "double[]"
  | "string[]"
  | "int[][]"
  | "string[][]"
  | "char[]";

export interface ParameterTypeDef {
  name: string;
  type: SupportedParamType;
}

function toBoolString(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value !== 0 ? "true" : "false";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) return "true";
    if (["0", "false", "no"].includes(normalized)) return "false";
  }
  throw new Error(`Invalid bool value: ${String(value)}`);
}

function toNumberString(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid numeric value: ${String(value)}`);
  }
  return String(num);
}

function serializeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, normalizeJsonValue(nested)])
    );
  }
  return value;
}

export function serializeInput(input: Record<string, unknown>, parameterTypes: ParameterTypeDef[]): string {
  const lines: string[] = [];

  for (const param of parameterTypes) {
    const value = input[param.name];

    switch (param.type) {
      case "int":
      case "long":
      case "float":
      case "double":
        lines.push(toNumberString(value));
        break;
      case "string":
        lines.push(serializeString(value));
        break;
      case "bool":
        lines.push(toBoolString(value));
        break;
      case "int[]":
      case "long[]":
      case "float[]":
      case "double[]":
      case "string[]":
      case "int[][]":
      case "string[][]":
      case "char[]":
        lines.push(JSON.stringify(normalizeJsonValue(value ?? [])));
        break;
      default:
        lines.push(JSON.stringify(normalizeJsonValue(value ?? null)));
        break;
    }
  }

  return `${lines.join("\n")}\n`;
}
