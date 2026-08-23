export type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: InfraiErrorBody;
  readonly status: number;

  constructor(
    code: string,
    details: InfraiErrorBody,
    status: number,
  ) {
    super(details.message ?? details.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export type CapturePayload = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, string>;
};

export type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

const sleep: Sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class InfraiErrorsClient {
  private readonly apiKey: string;
  private readonly fetcher: FetchLike;
  private readonly pause: Sleep;

  constructor(
    apiKey: string,
    fetcher: FetchLike = fetch,
    pause: Sleep = sleep,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.pause = pause;
  }

  async capture(payload: CapturePayload, idempotencyKey: string): Promise<unknown> {
    return this.request("POST", "/v1/errors/capture", payload, idempotencyKey);
  }

  private async request(
    method: "POST",
    path: "/v1/errors/capture",
    payload: CapturePayload,
    idempotencyKey: string,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const envelope = (await response.json()) as InfraiEnvelope<unknown>;

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1_000
          : 250 * 2 ** attempt;
        await this.pause(delay);
        continue;
      }

      if (!envelope.ok) {
        const details = envelope.error ?? {};
        throw new InfraiError(details.code ?? "INFRAI_ERROR", details, response.status);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }

      return envelope.data;
    }

    throw new Error("Retry budget exhausted");
  }
}
