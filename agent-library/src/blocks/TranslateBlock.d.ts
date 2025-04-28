import { AgentRuntimeClient } from '../client/AgentRuntimeClient';
import { AgentBlock } from './AgentBlock';
export declare class TranslateBlock implements AgentBlock<string, {
    translation: string;
}> {
    private agentClient;
    private static translationSchema;
    constructor(agentClient?: AgentRuntimeClient);
    run(input: string): Promise<{
        translation: string;
    }>;
}
