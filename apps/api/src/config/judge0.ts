export const JUDGE0_URL = (process.env["JUDGE0_URL"] ?? process.env["JUDGE0_API_URL"] ?? "http://localhost:2358").replace(/\/+$/, "");
export const JUDGE0_TIMEOUT_MS = parseInt(process.env["JUDGE0_TIMEOUT_MS"] ?? "10000", 10);
