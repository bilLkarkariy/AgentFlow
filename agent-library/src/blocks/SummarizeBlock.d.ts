import { AgentBlock } from './AgentBlock';
import { AgentRuntimeClient } from '../client/AgentRuntimeClient';
export declare class SummarizeBlock implements AgentBlock<string, {
    summary: string;
}> {
    private agentClient;
    private static summarySchema;
    static asTool(): import("./toOpenAITool").OpenAIToolDefinition;
    constructor(agentClient?: AgentRuntimeClient);
    run(input: string): Promise<{
        summary: string;
    }>;
}
