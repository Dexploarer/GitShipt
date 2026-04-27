import { z } from "zod";

const BagsRestErrorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    error: z.string().min(1),
  })
  .passthrough();

export function parseBagsRestEnvelope<TSchema extends z.ZodType>(
  raw: unknown,
  responseSchema: TSchema,
): z.infer<TSchema> {
  const parsed = z
    .union([
      z
        .object({
          success: z.literal(true),
          response: responseSchema,
        })
        .passthrough(),
      BagsRestErrorEnvelopeSchema,
    ])
    .parse(raw);

  if (!parsed.success) {
    throw new Error(`Bags API error: ${parsed.error}`);
  }

  return parsed.response as z.infer<TSchema>;
}
