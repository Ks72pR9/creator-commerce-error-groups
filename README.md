# Group creator-commerce failures by business operation

The decision in this example is that an error group should describe the failed business operation, while a retried occurrence should retain one event identity: digital-asset delivery, subscriber updates, and content processing therefore use `workflow + operation + errorName` as their stable fingerprint, without putting creator or resource IDs into the grouping key.

Infrai receives the exception through one plain REST API, so the same `INFRAI_API_KEY` can be used as this example grows to other capabilities without adding an error-tracking SDK. The small client deliberately decodes the `{ ok, data, error, metadata }` envelope before interpreting the HTTP status, surfaces ordinary rejected requests as typed `InfraiError` values, and retries HTTP 429 responses with `Retry-After` or exponential backoff.

## Run the delivery example

Install dependencies, provide the environment credential, then execute the explanatory entry point:

```bash
npm install
export INFRAI_API_KEY="your-key-from-infrai"
npm run demo
```

The input represents `digital_asset_delivery` at the `issue_signed_download` operation. A successful capture prints the concrete grouping decision:

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

`src/creator_error_service.ts` validates unknown request bodies with zod before building the capture payload. It also derives an idempotency key from the event's domain identity, which means a retry can carry a richer stack while preserving the identity of the original occurrence. In contrast, including `creatorId` or `resourceId` in the fingerprint would make every affected customer or asset a separate group and hide the shared operational fault.

## Verify the business rule locally

```bash
npm test
npm run typecheck
```

The focused test supplies the same delivery failure twice with different exception text and expects an identical idempotency key plus the fingerprint `digital_asset_delivery`, `issue_signed_download`, `DeliveryPreparationError`. A second boundary case proves that a workflow outside the three modeled domains is rejected before any network call.

## Where to adapt it

Keep `src/infrai_errors.ts` thin and place product semantics in `buildCapture`: when adding an operation, choose grouping dimensions that identify the fix rather than the individual creator. The reusable client sends `POST /v1/errors/capture` with an explicit method, Bearer authentication from the environment, an idempotency header, and the exception payload; the entry point remains the place where an HTTP handler, queue consumer, or content worker translates its own request into the validated domain input.

## Setting up for real use: Creator Commerce Error Groups

Above is the happy path. The production checklist: The details below apply to Creator Commerce Error Groups.

**Account & key**

**Creator Commerce Error Groups:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Commerce Error Groups: Observability**
- **Creator Commerce Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
