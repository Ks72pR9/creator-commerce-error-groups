import assert from "node:assert/strict";
import test from "node:test";
import { buildCapture, creatorFailureSchema } from "../src/creator_error_service.js";

test("retries of the same delivery failure keep one group and one event identity", () => {
  const input = creatorFailureSchema.parse({
    workflow: "digital_asset_delivery",
    operation: "issue_signed_download",
    creatorId: "creator_42",
    resourceId: "asset_7",
    errorName: "DeliveryPreparationError",
    message: "Download preparation could not complete",
    exception: "stack line 1",
  });

  const first = buildCapture(input);
  const retried = buildCapture({ ...input, exception: "stack line 1\nstack line 2" });

  assert.deepEqual(first.payload.fingerprint, [
    "digital_asset_delivery",
    "issue_signed_download",
    "DeliveryPreparationError",
  ]);
  assert.equal(first.idempotencyKey, retried.idempotencyKey);
  assert.equal(first.payload.context.resource_id, "asset_7");
});

test("an unsupported workflow is rejected at the request boundary", () => {
  const result = creatorFailureSchema.safeParse({
    workflow: "billing",
    operation: "charge",
    creatorId: "creator_42",
    resourceId: "order_7",
    errorName: "ChargeError",
    message: "Charge failed",
    exception: "ChargeError: Charge failed",
  });

  assert.equal(result.success, false);
});
