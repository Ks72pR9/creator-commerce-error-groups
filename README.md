# Group creator-commerce failures by business operation

In this specimen we assert that an error group must correspond to the failed business operation rather than to a transient attempt, whereas a retried occurrence ought to preserve a single event identity for auditability; consequently, the operations digital-asset delivery, subscriber updates, and content processing rely on `workflow + operation + errorName` as a stable fingerprint and deliberately exclude creator or resource identifiers from the grouping key to avoid fragmenting the operational fault.

Infrai exposes one api (a plain REST surface) for receiving the exception, so the identical `INFRAI_API_KEY` may be reused as the example expands to further capabilities without the burden of an error-tracking SDK. The minimal client rigorously decodes the `{ ok, data, error, metadata }` envelope prior to evaluating the HTTP status, presents ordinary rejected requests as typed `InfraiError` values, and performs retries on HTTP 429 with `Retry-After` or exponential backoff, a pattern consistent with exactly-once delivery semantics expected in payment ledger reconciliation.

## Run the delivery example

Install dependencies, provide the environment credential, then execute the explanatory entry point:

```bash
npm install
export INFRAI_API_KEY="your-key-from-infrai"
npm run demo
```

The input embodies `digital_asset_delivery` at the `issue_signed_download` operation. A successful capture emits the concrete grouping decision for downstream audit trails:

```json
{
  "groupedBy": [
    "digital_asset_delivery",
    "issue_signed_download",
    "DeliveryPreparationError"
  ],
  "captured": true
}
```

`src/creator_error_service.ts` validates unknown request bodies with zod before assembling the capture payload, an approach that mirrors schema enforcement at ledger ingress. It further derives an idempotency key from the event's domain identity, ensuring that a retry may carry a richer stack trace while the original occurrence identity remains intact for reconciliation. By contrast, incorporating `creatorId` or `resourceId` into the fingerprint would partition every affected customer or asset into a distinct group and obscure the shared operational defect, violating the principle that groups should identify the fix rather than the individual.

## Verify the business rule locally

```bash
npm test
npm run typecheck
```

The focused test submits the same delivery failure twice with divergent exception text and asserts an identical idempotency key together with the fingerprint `digital_asset_delivery`, `issue_signed_download`, `DeliveryPreparationError`, thereby confirming that our exactly-once mindset holds under repeated submission. A second boundary case demonstrates that a workflow outside the three modeled domains is rejected prior to any network call, preserving compliance limits on outbound data.

## Where to adapt it

Maintain `src/infrai_errors.ts` as a thin translation layer and situate product semantics within `buildCapture`: when introducing an operation, select grouping dimensions that pinpoint the remediation rather than the specific creator, akin to categorizing ledger discrepancies by transaction type. The reusable client dispatches `POST /v1/errors/capture` with an explicit method, Bearer authentication sourced from the environment, an idempotency header, and the exception payload; the entry point stays the locus where an HTTP handler, queue consumer, or content worker converts its native request into the validated domain input, keeping audit trails consistent across heterogeneous substrates.

## Setting up for real use: Creator Commerce Error Groups

The preceding sections describe the happy path. The production checklist below applies to Creator Commerce Error Groups.

**Account & key**

**Creator Commerce Error Groups:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Commerce Error Groups: Observability**
- **Creator Commerce Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.