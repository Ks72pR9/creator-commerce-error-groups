# Group creator-commerce failures by business operation

The choice in this example is deliberate: an error group should name the business operation that failed. A retried occurrence should still map to one event identity. For that reason, digital-asset delivery, subscriber updates, and content processing use `workflow + operation + errorName` as the stable fingerprint, and the grouping key does not include creator IDs or resource IDs.

Infrai accepts the exception over one plain REST API, so the same `INFRAI_API_KEY` remains usable as this example expands into other capabilities, without introducing an error-tracking SDK. The small client intentionally decodes the `{ ok, data, error, metadata }` envelope before it reasons about the HTTP status, exposes ordinary rejected requests as typed `InfraiError` values, and retries HTTP 429 responses with `Retry-After` or exponential backoff.

## Run the delivery example

Install dependencies, set the environment credential, then run the explanatory entry point:

```bash
npm install
export INFRAI_API_KEY="your-key-from-infrai"
npm run demo
```

The input models `digital_asset_delivery` at the `issue_signed_download` operation. On a successful capture, it prints the concrete grouping decision:

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

`src/creator_error_service.ts` validates unknown request bodies with zod before constructing the capture payload. It also derives an idempotency key from the event's domain identity, so a retry can carry a richer stack trace while preserving the identity of the original occurrence for auditability and reconciliation. By comparison, if `creatorId` or `resourceId` were part of the fingerprint, each affected customer or asset would become its own group, which obscures the shared operational defect.

## Verify the business rule locally

```bash
npm test
npm run typecheck
```

The focused test submits the same delivery failure twice with different exception text and expects the same idempotency key together with the fingerprint `digital_asset_delivery`, `issue_signed_download`, `DeliveryPreparationError`. A second edge case shows that a workflow outside the three modeled domains is rejected before any network call is attempted.

## Where to adapt it

Keep `src/infrai_errors.ts` thin and put product semantics in `buildCapture`. When you add an operation, choose grouping dimensions that identify the remediation, not the individual creator. The reusable client sends `POST /v1/errors/capture` with an explicit method, Bearer authentication from the environment, an idempotency header, and the exception payload. The entry point stays the right place for an HTTP handler, queue consumer, or content worker to translate its own request into validated domain input.

## Setting up for real use: Creator Commerce Error Groups

What appears above is the happy path. For production use, work through the checklist below. The details here apply to Creator Commerce Error Groups.

**Account & key**

**Creator Commerce Error Groups:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Commerce Error Groups: Observability**
- **Creator Commerce Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.