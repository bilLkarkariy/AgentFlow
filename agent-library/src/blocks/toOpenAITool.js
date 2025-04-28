"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOpenAITool = toOpenAITool;
const zod_1 = require("zod");
function toOpenAITool(opts) {
    const { name, description, schema } = opts;
    const json = { type: 'object', properties: {}, required: [] };
    const shape = schema.shape;
    for (const [key, def] of Object.entries(shape)) {
        let type = 'string';
        if (def._def.typeName === zod_1.z.ZodFirstPartyTypeKind.ZodNumber) {
            type = 'number';
        }
        else if (def._def.typeName === zod_1.z.ZodFirstPartyTypeKind.ZodBoolean) {
            type = 'boolean';
        }
        json.properties[key] = { type };
        if (!def.isOptional()) {
            json.required.push(key);
        }
    }
    return {
        name,
        description,
        parameters: json,
    };
}
//# sourceMappingURL=toOpenAITool.js.map