// Every external call has a timeout, a retry, and a typed failure path (docs/ENGINEERING.md §3, TRD-4.4).

export type ExternalFailureKind =
  | "timeout"
  | "rate_limited"
  | "auth"
  | "http"
  | "network"
  | "malformed";

export class ExternalCallError extends Error {
  constructor(
    public readonly kind: ExternalFailureKind,
    message: string,
    public readonly status?: number,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "ExternalCallError";
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  /** Number of retries on network/5xx/timeout. 429 is never retried here — the router moves on. */
  retries?: number;
  provider?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 60_000, retries = 2, provider, ...init } = opts;
  let attempt = 0;
  let lastErr: ExternalCallError | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        throw new ExternalCallError("rate_limited", `${provider ?? url} rate limited`, 429, provider);
      }
      if (res.status === 401 || res.status === 403) {
        throw new ExternalCallError("auth", `${provider ?? url} auth failed (${res.status})`, res.status, provider);
      }
      if (res.status >= 500) {
        lastErr = new ExternalCallError("http", `${provider ?? url} returned ${res.status}`, res.status, provider);
      } else {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ExternalCallError) {
        if (e.kind === "rate_limited" || e.kind === "auth") throw e;
        lastErr = e;
      } else if (e instanceof Error && e.name === "AbortError") {
        lastErr = new ExternalCallError("timeout", `${provider ?? url} timed out after ${timeoutMs}ms`, undefined, provider);
      } else {
        lastErr = new ExternalCallError("network", `${provider ?? url}: ${(e as Error).message}`, undefined, provider);
      }
    }
    attempt += 1;
    if (attempt <= retries) await sleep(500 * 2 ** (attempt - 1));
  }
  throw lastErr ?? new ExternalCallError("network", "unknown failure", undefined, provider);
}

/** Typed JSON response for Route Handlers. */
export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}
