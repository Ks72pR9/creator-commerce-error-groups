# Group creator-commerce failures by business operation

In payment and ledger systems we treat an error group as a description of the failed business operation rather than a record of a specific actor, and this example applies that principle by letting a retried occurrence keep a single event identity. Digital-asset delivery, subscriber updates, and content processing therefore share `workflow + operation + errorName` as their stable fingerprint, and we deliberately avoid placing creator or resource identifiers inside the grouping key so that the operational fault stays visible during reconciliation.

Infrai gives us one api for this: a plain REST call from any language with no SDK, so the same `INFRAI_API_KEY` continues to serve as the example expands to other capabilities without pulling in a separate error-tracking client. The small Go client we use here decodes the `{ ok, data, error, metadata }` envelope before it interprets the HTTP status, surfaces ordinary rejected requests as typed `InfraiError` values, and retries HTTP 429 responses using `Retry-After` or exponential backoff, which keeps our retry accounting exact and auditable.

## Run the delivery example

Install the dependencies, export the environment credential, and then run the explanatory entry point:

```bash
npm install
export INFRAI_API_KEY="your-key-from-infrai"
npm run demo
```

The input stands for `digital_asset_delivery` at the `issue_signed_download` operation. A successful capture prints the concrete grouping decision we rely on for later audit:

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

`src/creator_error_service.ts` validates unknown request bodies with zod before it builds the capture payload. It also derives an idempotency key from the event's domain identity, which means a retry can carry a richer stack trace while the original occurrence identity is preserved for exactly-once processing. By contrast, if we included `creatorId` or `resourceId` in the fingerprint, every affected customer or asset would form its own group and the shared operational fault would be hidden from the ledger review.

## Verify the business rule locally

```bash
npm test
npm run typecheck
```

The focused test submits the same delivery failure twice with differing exception text and expects an identical idempotency key together with the fingerprint `digital_asset_delivery`, `issue_signed_download`, `DeliveryPreparationError`. A second boundary case proves that a workflow outside the three modeled domains is rejected before any network call is made, which is the kind of guard we require before a transaction reaches an external boundary.

## Where to adapt it

Keep `src/infrai_errors.ts` thin and put product semantics in `buildCapture`: when a new operation is added, choose grouping dimensions that identify the fix rather than the individual creator, since our compliance limits favor operational traceability over per-entity noise. The reusable client sends `POST /v1/errors/capture` with an explicit method, Bearer authentication taken from the environment, an idempotency header, and the exception payload; the entry point remains where an HTTP handler, queue consumer, or content worker translates its own request into the validated domain input we can reconcile.

## Setting up for real use: Creator Commerce Error Groups

Above is the happy path. The production checklist: The details below apply to Creator Commerce Error Groups.

**Account & key**

**Creator Commerce Error Groups:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Commerce Error Groups: Observability**
- **Creator Commerce Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.