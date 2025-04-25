# AgentFlow Studio

This is the Studio application for designing and running flows with AgentFlow.

## Setup

```bash
pnpm install
pnpm run dev
```

## Node Types

Refer to `designer.md` for a full list of available node types.

## Agent Block Node

- Drag the **Agent Block** node (`agent`) onto the canvas.
- Configure:
  - **Prompt**: The input prompt text.
  - **Model**: Model name (e.g., `o4-mini`).
  - **Temperature**: Slider value from 0 to 1.
- Click **Simulate** to call the Agent Runtime `/run` endpoint and display the JSON response in the node.

## Examples

See `src/examples/agent-block.flow.ts` for a sample flow using the Agent Block node.

## Testing

- **Unit tests** (Jest + React Testing Library):

  ```bash
  pnpm run test:unit
  ```

- **End-to-end tests** (Playwright):

  ```bash
  pnpm run test
  ```
