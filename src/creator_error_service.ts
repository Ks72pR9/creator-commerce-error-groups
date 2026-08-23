import { createHash } from "node:crypto";
import { z } from "zod";
import { InfraiErrorsClient, type CapturePayload } from "./infrai_errors.js";

export const creatorFailureSchema = z.object({
  workflow: z.enum([
    "digital_asset_delivery",
    "subscriber_update",
    "content_processing",
  ]),
  operation: z.string().min(1).max(80),
  creatorId: z.string().min(1).max(120),
  resourceId: z.string().min(1).max(120),
  errorName: z.string().min(1).max(120),
  message: z.string().min(1).max(2_000),
  exception: z.string().min(1).max(20_000),
});

export type CreatorFailure = z.infer<typeof creatorFailureSchema>;

export function buildCapture(input: CreatorFailure): {
  payload: CapturePayload;
  idempotencyKey: string;
} {
  const fingerprint = [input.workflow, input.operation, input.errorName];
  const eventIdentity = [
    input.workflow,
    input.operation,
    input.creatorId,
    input.resourceId,
    input.errorName,
    input.message,
  ].join("\u0000");

  return {
    payload: {
      title: `${input.workflow}: ${input.operation} failed`,
      message: input.message,
      level: "error",
      fingerprint,
      exception: input.exception,
      context: {
        workflow: input.workflow,
        operation: input.operation,
        creator_id: input.creatorId,
        resource_id: input.resourceId,
      },
    },
    idempotencyKey: createHash("sha256").update(eventIdentity).digest("hex"),
  };
}

export async function captureCreatorFailure(
  body: unknown,
  client: InfraiErrorsClient,
): Promise<{ groupedBy: string[]; captured: true }> {
  const input = creatorFailureSchema.parse(body);
  const { payload, idempotencyKey } = buildCapture(input);
  await client.capture(payload, idempotencyKey);
  return { groupedBy: payload.fingerprint, captured: true };
}

async function main(): Promise<void> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

  const result = await captureCreatorFailure(
    {
      workflow: "digital_asset_delivery",
      operation: "issue_signed_download",
      creatorId: "creator_42",
      resourceId: "asset_2026_08",
      errorName: "DeliveryPreparationError",
      message: "Download preparation could not complete",
      exception: "DeliveryPreparationError: Download preparation could not complete",
    },
    new InfraiErrorsClient(apiKey),
  );

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
