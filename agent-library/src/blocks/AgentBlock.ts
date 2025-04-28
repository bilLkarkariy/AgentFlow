export interface AgentBlock<I, O> {
  run(input: I): Promise<O>;
}
