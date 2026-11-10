## 7. Bridge “Custom Tool” (Ex‑Agent Blocks)

### 7.1  Design global
```text
Python flow_runner.py                                 NestJS API (internal)
┌───────────────────┐   HTTP POST /internal/tools/:toolId   ┌────────────────────────┐
│ GenericBackendTool │ ───────────────────────────────────▶ │ ToolController.execute │
│  (callable)        │ ◀──────────── JSON reply ─────────── │   (invokes service)    │
└───────────────────┘                                     └────────────────────────┘
```
* FlowEngine serializes each block via `toOpenAITool()`, producing a backend-tool entry in the payload:  
  ```json
  {
    "toolType": "backend",
    "toolId": "summarize-block",
    "parameters": {
      "type": "object",
      "properties": { "text": { "type": "string" } },
      "required": ["text"]
    }
  }
  ```  
* In `flow_runner.py`, each backend tool becomes an SDK `FunctionTool` (the SDK
  only accepts its own tool types, not a plain callable):
  ```python
  def mk_backend_tool(tool: dict, timeout: float = None) -> FunctionTool:
      url = f"{base}/internal/tools/{tool['toolId']}"

      async def on_invoke_tool(_ctx, arguments: str) -> str:
          resp = await asyncio.to_thread(
              requests.post, url, json=json.loads(arguments or "{}"), timeout=timeout
          )
          resp.raise_for_status()
          return json.dumps(resp.json())

      return FunctionTool(
          name=tool["name"],
          description=tool.get("description", ""),
          params_json_schema=tool.get("parameters") or {"type": "object", "properties": {}},
          on_invoke_tool=on_invoke_tool,
          strict_json_schema=False,
      )
  ```
  An HTTP failure is returned to the model as the tool output; it does not
  fail the run.
* `toolType: "function"` names an in-process tool registered in
  `flow_runner.LOCAL_TOOLS` by `toolId`. The registry is empty today: a flow
  that names an unknown function tool fails with a clear error.
### 7.2  Côté NestJS
```ts
// tools.module.ts
@Controller('/internal/tools')
export class ToolController {
  constructor(private readonly summarize: SummarizeService, /* … */) {}

  @Post(':id')
  exec(@Param('id') id: string, @Body() payload: any) {
    switch (id) {
      case 'summarize-block':
        return this.summarize.run(payload.text);
      /* … */
      default:
        throw new BadRequestException('Unknown tool');
    }
  }
}
```
*Exposition interne seulement : la route exige le jeton `X-Internal-Token` que l'API transmet à ses runners au lancement (`InternalTokenGuard`).*

### 7.3  toOpenAITool in TypeScript  
```typescript
interface OpenAITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  toolType: 'backend' | 'function';
  toolId: string;
}

class SummarizeBlock {
  toOpenAITool(): OpenAITool {
    return {
      name: this.id,
      description: this.description,
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      toolType: 'backend',
      toolId: 'summarize-block',
    };
  }
}

// FlowEngineService.serialize():
const agentTools = flow.nodes.map(n =>
  (n as any).tools?.map((blk: any) =>
    typeof blk.toOpenAITool === 'function' ? blk.toOpenAITool() : blk
  )
)[0];
```

### 7.4  FlowEngine changes
* Lors de la sérialisation, si un node DSL est `type: SummarizeBlock`, on émet `toolType:"backend"` et `toolId`.
* Unit test : mock HTTP → vérifier round‑trip.

---

## 8. Middleware “Cancel Run” (Tâche 2)

### 8.1  Registry des runs
```ts
// run-registry.service.ts
@Injectable({ scope: Scope.DEFAULT })
export class RunRegistry {
  private readonly map = new Map<string, ChildProcess>()
  add(id: string, proc: ChildProcess) { this.map.set(id, proc); }
  cancel(id: string) {
    const p = this.map.get(id); if (p) { p.kill('SIGKILL'); this.map.delete(id); }
  }
  remove(id:string){ this.map.delete(id); }
}
```
`AgentPythonClientService` génère `runId = randomUUID()` juste après `acquire()`, ajoute le worker au registry et renvoie le runId en 1ᵉʳ event SSE:
```ts
observer.next(JSON.stringify({event:'runId', data: runId}));
```

### 8.2  WebSocket Gateway
```ts
@WebSocketGateway({ path: '/ws' })
export class FlowControlGateway {
  constructor(private readonly registry: RunRegistry) {}

  @SubscribeMessage('control')
  onControl(@MessageBody() msg: { op: string; runId: string }) {
    if (msg.op === 'cancel') this.registry.cancel(msg.runId);
  }
}
```

Frontend :
```js
socket.emit('control', { op: 'cancel', runId });
```

### 8.3  Fallback HTTP (Optionnel)
```ts
@Delete('/flows/:runId/cancel')
cancel(@Param('runId') id: string, @Inject(RunRegistry) reg: RunRegistry){
  reg.cancel(id);
  return { status: 'cancelled' };
}
```

### 8.4  Python côté runner
Le `KeyboardInterrupt` est capté automatiquement ; prévoir un `try/except asyncio.CancelledError` pour fermer proprement les sessions HTTP internes.

---

### Prochaines actions
1. Implémenter `GenericBackendTool` helper (Python) + tests Pytest.  
2. Ajouter `ToolController` côté Nest + services existants (✅ déjà implémenté)  
3. Introduire `RunRegistry` et Gateway cancel (✅ déjà implémenté)  
4. Mettre à jour le Front (barre de progression + bouton Stop).

### Détails des prochaines actions

#### 1. Implémenter `GenericBackendTool` helper (Python) + tests Pytest
- Dans `api/python/flow_runner.py`, extraire `mk_backend_tool` dans une classe `GenericBackendTool` réutilisable :
  - Ajouter gestion d’erreurs réseau et timeouts.
  - Documenter la méthode pour les développeurs.
- Créer des tests Pytest dans `api/python/test_flow_runner_backend.py` :
  - Cas nominal (round-trip HTTP).
  - Erreur 4xx/5xx (vérifier levée d’exception).
  - Paramètres manquants ou invalides.

#### 2. Ajouter `ToolController` côté NestJS + services existants (✅ déjà implémenté)
- Voir `api/src/modules/tools/tool.controller.ts`

#### 3. Introduire `RunRegistry` et WebSocket Gateway pour la cancelation (✅ déjà implémenté)
- Voir `api/src/modules/tasks/runs.controller.ts` et `api/test/runs.e2e.spec.ts`

#### 4. Mettre à jour le front-end (barre de progression + bouton Stop)
- Dans `TestBar.tsx`, ajouter :
  - Un composant `ProgressBar` lié aux tokens SSE (compteur de tokens reçus).
  - Un bouton `Stop` qui envoie `{op:'cancel', runId}` via WebSocket.
- Dans `DesignerPage.tsx`, gérer :
  - Initialisation du client WebSocket (connexion au `FlowControlGateway`).
  - Réception des updates de progression et affichage dans `ProgressBar`.
  - Envoi du message `control` pour arrêter le run.
- Tester manuellement le flux : lancer un run, cliquer Stop, vérifier que le runner Python est tué et que l’UI stoppe l’affichage des tokens.
