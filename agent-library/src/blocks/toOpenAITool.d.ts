import { ZodObject, ZodRawShape } from 'zod';
export interface OpenAIToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}
export declare function toOpenAITool<T extends ZodRawShape>(opts: {
    name: string;
    description: string;
    schema: ZodObject<T>;
}): OpenAIToolDefinition;
