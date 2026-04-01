export const JUDGE0_URL = (process.env["JUDGE0_URL"] ?? process.env["JUDGE0_API_URL"] ?? "http://localhost:2358").replace(/\/+$/, "");

// Individual HTTP request timeout (ms) — how long to wait for a single Judge0 API call.
export const JUDGE0_TIMEOUT_MS = parseInt(process.env["JUDGE0_TIMEOUT_MS"] ?? "30000", 10);

// Per-submission resource limits passed directly to Judge0.
// These OVERRIDE whatever defaults are set in the Judge0 Docker instance config.
// cpu_time_limit: Max CPU seconds the code may consume (default: 10s)
export const JUDGE0_CPU_TIME_LIMIT = parseFloat(process.env["JUDGE0_CPU_TIME_LIMIT"] ?? "14");
// wall_time_limit: Max wall-clock seconds (must be > cpu_time_limit); default 19s (Judge0 cap is 20)
export const JUDGE0_WALL_TIME_LIMIT = parseFloat(process.env["JUDGE0_WALL_TIME_LIMIT"] ?? "19");
// memory_limit: Max memory in kilobytes (default: 256 MB = 262144 KB)
export const JUDGE0_MEMORY_LIMIT = parseInt(process.env["JUDGE0_MEMORY_LIMIT"] ?? "262144", 10);