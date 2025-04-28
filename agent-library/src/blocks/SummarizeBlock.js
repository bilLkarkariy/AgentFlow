"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizeBlock = void 0;
const AgentRuntimeClient_1 = require("../client/AgentRuntimeClient");
const zod_1 = require("zod");
const toOpenAITool_1 = require("./toOpenAITool");
class SummarizeBlock {
    agentClient;
    static summarySchema = zod_1.z.object({ summary: zod_1.z.string() });
    static asTool() {
        return (0, toOpenAITool_1.toOpenAITool)({
            name: 'SummarizeBlock',
            description: 'Summarization assistant returning { summary: string }.',
            schema: zod_1.z.object({ text: zod_1.z.string() }),
        });
    }
    constructor(agentClient = new AgentRuntimeClient_1.AgentRuntimeClient()) {
        this.agentClient = agentClient;
    }
    async run(input) {
        const prompt = `You are an expert summarization assistant. Return a JSON object with a single key "summary" whose value is a concise summary (max 3 sentences). Do not include other commentary.\n\nUSER:\n${input}`;
        const raw = await this.agentClient.run({ prompt });
        const parsedRaw = JSON.parse(raw);
        const parsed = SummarizeBlock.summarySchema.parse(parsedRaw);
        return parsed;
    }
}
exports.SummarizeBlock = SummarizeBlock;
//# sourceMappingURL=SummarizeBlock.js.map