/**
 * Replace globalThis.fetch for the duration of a test so signer proxy routes
 * never hit the network. Any intercepted URL/body can be inspected via the
 * returned `calls` array. Non-signer URLs throw so we notice leaks.
 */

export interface RecordedFetchCall {
  url: string;
  method: string;
  body: unknown;
}

export interface MockSignerController {
  calls: RecordedFetchCall[];
  restore: () => void;
  /** Switch default success responses for a specific path to failure. */
  failNext: (path: string, status?: number) => void;
}

export function mockSignerFetch(opts?: {
  signerHost?: string;
  signOrchestratorInfoResponse?: unknown;
  signByocJobResponse?: unknown;
  discoverOrchestratorsResponse?: unknown;
  generateLivePaymentResponse?: unknown;
  dashboardPricingResponse?: unknown;
  pipelineCatalogResponse?: unknown;
}): MockSignerController {
  const signerHost = opts?.signerHost ?? "http://test-signer.invalid";
  const signerOrigin = new URL(signerHost).origin;
  const original = globalThis.fetch;

  const calls: RecordedFetchCall[] = [];
  const failures = new Map<string, number>();

  const pathDefaults: Record<string, unknown> = {
    "/sign-orchestrator-info":
      opts?.signOrchestratorInfoResponse ?? { signedData: "mock-signed" },
    "/sign-byoc-job":
      opts?.signByocJobResponse ?? { signedJob: "mock-signed" },
    "/discover-orchestrators":
      opts?.discoverOrchestratorsResponse ?? { orchestrators: [] },
    "/generate-live-payment":
      opts?.generateLivePaymentResponse ?? { payment: "mock-payment" },
  };

  const controller: MockSignerController = {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
    failNext: (path, status = 500) => {
      failures.set(path, status);
    },
  };

  const mocked: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    let body: unknown = undefined;
    const rawBody = init?.body;
    if (typeof rawBody === "string" && rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
    calls.push({ url, method, body });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(
        `mockSignerFetch: invalid URL in test: ${method} ${url}`,
      );
    }
    if (opts?.dashboardPricingResponse !== undefined && parsedUrl.pathname.endsWith("/dashboard/pricing")) {
      return new Response(JSON.stringify(opts.dashboardPricingResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (opts?.pipelineCatalogResponse !== undefined && parsedUrl.pathname.endsWith("/dashboard/pipeline-catalog")) {
      return new Response(JSON.stringify(opts.pipelineCatalogResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (parsedUrl.origin !== signerOrigin) {
      throw new Error(
        `mockSignerFetch: unexpected non-signer fetch in test: ${method} ${url}`,
      );
    }

    const path = parsedUrl.pathname;
    const failureStatus = failures.get(path);
    if (failureStatus) {
      failures.delete(path);
      return new Response(JSON.stringify({ error: "mock failure" }), {
        status: failureStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    const responseBody =
      pathDefaults[path] ?? { ok: true, echoed: { path, body } };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  globalThis.fetch = mocked as typeof fetch;

  return controller;
}
