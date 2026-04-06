export const JUDGE0_URL = (process.env["JUDGE0_URL"] ?? process.env["JUDGE0_API_URL"] ?? "http://localhost:2358").replace(/\/+$/, "");

if (!process.env["JUDGE0_URL"] && process.env["JUDGE0_API_URL"]) {
	// eslint-disable-next-line no-console
	console.warn("[config] JUDGE0_API_URL is deprecated. Please use JUDGE0_URL instead.");
}

// Individual HTTP request timeout (ms) — how long to wait for a single Judge0 API call.
export const JUDGE0_TIMEOUT_MS = parseInt(process.env["JUDGE0_TIMEOUT_MS"] ?? "30000", 10);

// Per-submission resource limits passed directly to Judge0.
// These OVERRIDE whatever defaults are set in the Judge0 Docker instance config.
// cpu_time_limit: Max CPU seconds the code may consume (default: 10s)
export const JUDGE0_CPU_TIME_LIMIT = parseFloat(process.env["JUDGE0_CPU_TIME_LIMIT"] ?? "10");
// wall_time_limit: Max wall-clock seconds (must be > cpu_time_limit)
export const JUDGE0_WALL_TIME_LIMIT = parseFloat(process.env["JUDGE0_WALL_TIME_LIMIT"] ?? "20");
// memory_limit: Max memory in kilobytes (default: ~879 MB = 900000 KB)
export const JUDGE0_MEMORY_LIMIT = parseInt(process.env["JUDGE0_MEMORY_LIMIT"] ?? "900000", 10);

// Upper bounds enforced by many Judge0 CE deployments (422 if exceeded).
export const JUDGE0_MAX_CPU_TIME_LIMIT = parseFloat(process.env["JUDGE0_MAX_CPU_TIME_LIMIT"] ?? "20");
export const JUDGE0_MAX_WALL_TIME_LIMIT = parseFloat(process.env["JUDGE0_MAX_WALL_TIME_LIMIT"] ?? "20");
export const JUDGE0_MAX_MEMORY_LIMIT = parseInt(process.env["JUDGE0_MAX_MEMORY_LIMIT"] ?? "2097152", 10);

// Polling behavior for fetching asynchronous submission results.
export const JUDGE0_POLL_MAX_ATTEMPTS = parseInt(process.env["JUDGE0_POLL_MAX_ATTEMPTS"] ?? "25", 10);
export const JUDGE0_POLL_INITIAL_DELAY_MS = parseInt(process.env["JUDGE0_POLL_INITIAL_DELAY_MS"] ?? "500", 10);
export const JUDGE0_POLL_MAX_DELAY_MS = parseInt(process.env["JUDGE0_POLL_MAX_DELAY_MS"] ?? "2000", 10);

// Max extra attempts after the first request for transient Judge0 5xx / network failures (503 overload is common on self-hosted CE).
export const JUDGE0_REQUEST_RETRIES = parseInt(process.env["JUDGE0_REQUEST_RETRIES"] ?? "5", 10);

// BullMQ submission worker concurrency.
export const WORKER_CONCURRENCY = parseInt(process.env["WORKER_CONCURRENCY"] ?? "4", 10);