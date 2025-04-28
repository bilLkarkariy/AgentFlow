import { z, ZodObject, ZodRawShape } from 'zod';

export interface OpenAIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Quick helper: convert a Zod schema describing `parameters` into
 * a JSON schema object consumable by the OpenAI Agents SDK.
 * NB: This is *not* a full zod → JSON-schema conversion, but works
 *     for simple primitives (string, number, boolean). Extend if needed.
 */
export function toOpenAITool<T extends ZodRawShape>(opts: {
  name: string;
  description: string;
  schema: ZodObject<T>; // z.object({ ... }) describing parameters
}): OpenAIToolDefinition {
  const { name, description, schema } = opts;
  const json: Record<string, unknown> = { type: 'object', properties: {}, required: [] };

  const shape = schema.shape;
  for (const [key, def] of Object.entries(shape)) {
    let type: string = 'string';
    if (def._def.typeName === z.ZodFirstPartyTypeKind.ZodNumber) {
      type = 'number';
    } else if (def._def.typeName === z.ZodFirstPartyTypeKind.ZodBoolean) {
      type = 'boolean';
    }
    (json.properties as any)[key] = { type };
    if (!def.isOptional()) {
      (json.required as string[]).push(key);
    }
  }

  return {
    name,
    description,
    parameters: json,
  };
}
