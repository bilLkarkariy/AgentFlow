"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslateBlock = void 0;
const AgentRuntimeClient_1 = require("../client/AgentRuntimeClient");
const zod_1 = require("zod");
class TranslateBlock {
    agentClient;
    static translationSchema = zod_1.z.object({ translation: zod_1.z.string() });
    constructor(agentClient = new AgentRuntimeClient_1.AgentRuntimeClient()) {
        this.agentClient = agentClient;
    }
    async run(input) {
        const prompt = `You are a translation assistant. Translate the following text into English. Return a JSON object with a single key \"translation\" whose value is the translated text, with no additional commentary.\n\nUSER:\n${input}`;
        const raw = await this.agentClient.run({ prompt });
        const parsedRaw = JSON.parse(raw);
        const parsed = TranslateBlock.translationSchema.parse(parsedRaw);
        return parsed;
    }
}
exports.TranslateBlock = TranslateBlock;
//# sourceMappingURL=TranslateBlock.js.map