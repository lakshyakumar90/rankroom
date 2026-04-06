/**
 * Centralized configuration for language-specific Judge0 execution limits and options.
 * This ensures stability (e.g. JVM heap size) and optimization (e.g. C++ -O2)
 * across the platform.
 */

export interface LanguageExecutionConfig {
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  stack_limit?: number;
  enable_per_process_and_thread_time_limit?: boolean;
  // Note: Correct Judge0 key is enable_per_process_and_thread_memory_limit
  enable_per_process_and_thread_memory_limit?: boolean;
  compiler_options?: string;
}

export type TypeScriptExecutionMode = "transpile" | "native";

interface RuntimeOverheadProfile {
  minCpuSec: number;
  minMemoryKb: number;
  extraCpuSec: number;
  extraMemoryKb: number;
  wallMultiplier: number;
}

export interface ComputedExecutionLimits {
  cpu_time_limit: number;
  wall_time_limit: number;
  memory_limit: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const TS_EXECUTION_MODE: TypeScriptExecutionMode =
  process.env["TS_EXECUTION_MODE"] === "native" ? "native" : "transpile";

export const MAX_SOURCE_CODE_BYTES = parsePositiveInt(process.env["MAX_SOURCE_CODE_BYTES"], 65536);
export const MAX_STDIN_BYTES = parsePositiveInt(process.env["MAX_STDIN_BYTES"], 32768);
export const MAX_OUTPUT_BYTES = parsePositiveInt(process.env["MAX_OUTPUT_BYTES"], 16384);
export const MAX_TEST_CASES_PER_RUN = parsePositiveInt(process.env["MAX_TEST_CASES_PER_RUN"], 50);
export const MAX_TEST_CASES_PER_SUBMIT = parsePositiveInt(process.env["MAX_TEST_CASES_PER_SUBMIT"], 100);

export function byteLengthUtf8(value: string | null | undefined): number {
  return Buffer.byteLength(value ?? "", "utf8");
}

export function truncateUtf8(value: string | null, maxBytes = MAX_OUTPUT_BYTES): string | null {
  if (value === null) return null;
  if (byteLengthUtf8(value) <= maxBytes) return value;

  const bytes = Buffer.from(value, "utf8");
  const suffix = "\n...[truncated]";
  const suffixBytes = Buffer.byteLength(suffix, "utf8");
  const slice = bytes.subarray(0, Math.max(0, maxBytes - suffixBytes));

  return `${slice.toString("utf8")}${suffix}`;
}

/**
 * Language-specific overrides.
 * Keys are Judge0 language IDs or general categories if we handle mapping elsewhere.
 * For RankRoom, we primarily use the IDs returned by the user's Judge0 instance.
 */
export const EXECUTION_CONFIGS: Record<number, LanguageExecutionConfig> = {
  // Java (OpenJDK 13.0.1 - ID 62)
  // Fix: Aggressive memory reduction. 
  // - SerialGC is much lighter than G1GC.
  // - AggressiveHeap/ShrinkHeap triggers.
  // - Xss256k reduces thread stack size.
  // We go back to 512000 (512MB) to stay within common Docker defaults.
  62: {
    cpu_time_limit: 10,
    wall_time_limit: 20,
    memory_limit: 900000,
    stack_limit: 64000,
    enable_per_process_and_thread_time_limit: true,
    enable_per_process_and_thread_memory_limit: true,
    compiler_options: "-J-Xms32m -J-Xmx192m -J-Xss256k -J-XX:+UseSerialGC -J-XX:MaxMetaspaceSize=128m -J-XX:CompressedClassSpaceSize=64m",
  },
  // Java (Generic ID 91)
  91: {
    cpu_time_limit: 10,
    wall_time_limit: 20,
    memory_limit: 900000,
    stack_limit: 64000,
    enable_per_process_and_thread_time_limit: true,
    enable_per_process_and_thread_memory_limit: true,
    compiler_options: "-J-Xms32m -J-Xmx192m -J-Xss256k -J-XX:+UseSerialGC -J-XX:MaxMetaspaceSize=128m -J-XX:CompressedClassSpaceSize=64m",
  },
  // C++ (GCC 9.2.0 - ID 54 or Clang - ID 76)
  54: { compiler_options: "-O2" },
  76: { compiler_options: "-O2" },
  52: { compiler_options: "-O2" },
  53: { compiler_options: "-O2" },
  // C (GCC 9.2.0 - ID 50 or Clang - ID 75)
  50: { compiler_options: "-O2" },
  75: { compiler_options: "-O2" },
  48: { compiler_options: "-O2" },
  49: { compiler_options: "-O2" },

  // JavaScript (Node.js 12/18 - IDs 63, 93)
  63: {
    cpu_time_limit: 10,
    wall_time_limit: 20,
    memory_limit: 900000,
  },
  93: {
    cpu_time_limit: 10,
    wall_time_limit: 20,
    memory_limit: 900000,
  },

  // TypeScript (Node.js 12/18 - IDs 74, 94) — compile + run needs generous wall/cpu
  74: {
    cpu_time_limit: 14,
    wall_time_limit: 20,
    memory_limit: 900000,
  },
  94: {
    cpu_time_limit: 14,
    wall_time_limit: 20,
    memory_limit: 900000,
  },

  // Python 3 (ID 71)
  71: {
    cpu_time_limit: 6,
    wall_time_limit: 15,
    memory_limit: 131072,
  },

  // Python 2 (ID 70)
  70: {
    cpu_time_limit: 6,
    wall_time_limit: 15,
    memory_limit: 131072,
  },
};

function resolveRuntimeProfile(languageId: number): RuntimeOverheadProfile {
  // Java
  if (languageId === 62 || languageId === 91) {
    return {
      minCpuSec: 10,
      minMemoryKb: 900000,
      extraCpuSec: 3,
      extraMemoryKb: 65536,
      wallMultiplier: 2,
    };
  }

  // JavaScript
  if (languageId === 63 || languageId === 93) {
    return {
      minCpuSec: 8,
      minMemoryKb: 900000,
      extraCpuSec: 1,
      extraMemoryKb: 32768,
      wallMultiplier: 2,
    };
  }

  // TypeScript
  if (languageId === 74 || languageId === 94) {
    return {
      minCpuSec: 10,
      minMemoryKb: 900000,
      extraCpuSec: 4,
      extraMemoryKb: 65536,
      wallMultiplier: 2,
    };
  }

  // Python
  if (languageId === 70 || languageId === 71) {
    return {
      minCpuSec: 5,
      minMemoryKb: 131072,
      extraCpuSec: 1,
      extraMemoryKb: 20480,
      wallMultiplier: 2.5,
    };
  }

  // C/C++ and others
  return {
    minCpuSec: 2,
    minMemoryKb: 65536,
    extraCpuSec: 0,
    extraMemoryKb: 0,
    wallMultiplier: 2,
  };
}

export function computeExecutionLimits(
  languageId: number,
  problemTimeLimitMs: number,
  problemMemoryLimitKb: number
): ComputedExecutionLimits {
  const profile = resolveRuntimeProfile(languageId);
  const cfg = getExecutionConfig(languageId);

  const baseCpu = Math.max(0.1, problemTimeLimitMs / 1000);
  const baseMemory = Math.max(0, problemMemoryLimitKb);

  const cpu_time_limit = Math.max(
    baseCpu + profile.extraCpuSec,
    profile.minCpuSec,
    cfg.cpu_time_limit ?? 0
  );

  const memory_limit = Math.max(
    baseMemory + profile.extraMemoryKb,
    profile.minMemoryKb,
    cfg.memory_limit ?? 0
  );

  const wall_time_limit = Math.max(
    cpu_time_limit + 3,
    cpu_time_limit * profile.wallMultiplier,
    cfg.wall_time_limit ?? 0
  );

  return {
    cpu_time_limit,
    wall_time_limit,
    memory_limit,
  };
}

/**
 * Helper to get the best execution config for a given language ID.
 * Falls back to global defaults if no specific config exists.
 */
export function getExecutionConfig(languageId: number): LanguageExecutionConfig {
  return EXECUTION_CONFIGS[languageId] || {};
}
