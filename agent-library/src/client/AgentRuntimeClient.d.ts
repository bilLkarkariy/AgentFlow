interface RunRequest {
    prompt: string;
    parameters?: Record<string, string>;
}
export declare class AgentRuntimeClient {
    private host;
    private client;
    constructor(host?: string);
    run(request: RunRequest): Promise<string>;
}
export {};
