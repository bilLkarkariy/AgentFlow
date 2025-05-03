import { z } from 'zod';

export const FlowPayloadSchema = z.object({
  runId: z.string(),
  traceId: z.string().optional(),
  input: z.string(),
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      instructions: z.string(),
      model: z.string().optional(),
      tools: z.array(
        z.union([
          z.string(),
          z.object({
            name: z.string(),
            description: z.string(),
            parameters: z.any(),
            toolType: z.enum(["backend", "function"]),
            toolId: z.string(),
          }),
        ])
      ).optional(),
    })
  ),
  edges: z.array(z.tuple([z.string(), z.string()])),
  config: z
    .object({ max_turns: z.number().int().default(8) })
    .optional(),
});

export type FlowPayload = z.infer<typeof FlowPayloadSchema>;
