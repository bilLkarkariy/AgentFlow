# AgentFlow — Sprint 6 Plan (v2.1 — “OpenAI Agents SDK”)

> **Période :** 12 → 23 mai 2025 (10 jours ouvrés)  
> **Capacité cible :** 60 Story Points (SP)  
> **Team** : 1 PO, 1 UX, 4 devs full‑stack, 1 ML/DevOps  
> **Goal** : livrer une exécution multi‑agents « wow » via **openai‑agents‑python** intégrée à `agent-runtime`.

---

## 1. Vision Sprint
« Un utilisateur assemble un flow de trois Blocks (Summarize → Classify Email → Extract Invoice), clique **Run**, voit le résultat et les logs temps réel, pendant que la plateforme mesure le coût tokens. »

---

## 2. Backlog Sprint (détail par tâche)

| ID | Tâche & SP | **Objectif métier** | **Comment faire (guide dev)** | **Critères d’acceptation / DoD** |
|----|------------|---------------------|--------------------------------|----------------------------------|
| **US‑37** <br>8 SP ✅ | **Orchestrateur supporte `task_type = agent`** | Pouvoir en‑queue‑r un run agent dans BullMQ pour scale. | 1. Ajouter colonne `task_type` default="flow" dans `TaskRun` entity. 2. Étendre `execute.processor.ts` pour router vers gRPC `AgentRuntimeClient`. 3. Unit‑tests Jest (mock gRPC). | • Migration TypeORM ok.<br>• Job "agent" apparaît dans Bull Board.<br>• Tests unitaires verts (coverage > 80 %). |
| **TECH‑01** <br>3 SP | **gRPC stub Python** | Bridge inter‑langages stable. | 1. Exécuter `python -m grpc_tools.protoc -I proto --python_out=. --grpc_python_out=. proto/agent.proto`. 2. Commit stub dans `agent-runtime/python/proto`. | • Stub généré sans diff CI.<br>• importable dans worker PoC. |
| **TECH‑02** <br>5 SP | **Side‑car Docker openai‑agents** | Permettre l’exécution SDK dans le même Pod. | 1. Dockerfile :
```Dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install openai-agents==0.3.* fastapi uvicorn==0.29.* grpcio==1.63.*
COPY server.py .
CMD ["python","server.py"]
```
2. `server.py` : FastAPI + gRPC server implémentant `RunAgent`. 3. Helm override `agent-runtime` chart (`extraContainers`). | • `kubectl logs` affiche "Agents SDK ready".<br>• Port 50051 accessible depuis NestJS pod. |
| **TECH‑03** <br>1 SP ✅ | **AgentPythonClient (NestJS)** | Appeler facilement le side‑car. | 1. `ClientsModule.register([{name:'AG_PY', transport:Transport.GRPC, ...}])`. 2. Méthode `runAgent(dto)` asObservable(). | • gRPC call renvoie stub “Hello Agent” dans e2e. |
| **US‑38** <br>8 SP | **Library initiale Agent Blocks** | Offrir 3 Blocks démo end‑to‑end. | 1. Créer `SummarizeBlock`, `EmailClassifierBlock`, `InvoiceExtractorBlock` dans `agent-library`. 2. Fournir `asTool()` method retournant types pydantic. 3. Exemple flow JSON dans `/examples/demo.flow.json`. | • `pnpm test -F agent-library` OK.<br>• JSON valide via AJV.<br>• Blocks visibles dans Storybook. |
| **US‑39** <br>5 SP | **Mapping DSL → Tools auto** | Générer toolset AgentsSDK. | 1. `dsl-parser.service.ts`: pour chaque node, appeler `toTool()` du Block. 2. Concaténer dans array & passer à Python client. 3. Integration‑test: flow JSON ⇒ tool names list size == nodes count. | • Flow à 3 nodes génère 3 tools.<br>• Test e2e passe. |
| **TECH‑04** <br>3 SP | **Token metering + quotas** | Contrôler coûts avant démo. | 1. Ajouter middleware Python pour publier `usage` sur Redis channel `agent_usage`. 2. Implémenter `quota-reporter.service.ts` pour incrémenter Stripe usage record. 3. Grafana panel “Cost / run”. | • Usage record crée dans Stripe test.<br>• Panel Grafana retourne data. |
| **TECH‑05** <br>3 SP | **Observabilité OTEL** | Corréler traces Node ↔ Py. | 1. exporter OTLP depuis side‑car vers collector 4318. 2. `otel-sdk.ts` : new span “agent.run”. 3. Dashboard Tempo/Grafana import. | • Trace complète visible Jaeger UI. |
| **QA‑01** <br>2 SP | **Playwright e2e “Run demo.flow.json”** | Empêcher régression. | 1. Script UI: importer flow, click Run, attendre output contains “Montant TTC”. | • Test vert dans CI & < 90 s. |
| **DOC‑01** <br>2 SP | **README Agents** | Onboarding externe. | 1. Section install, proto, env vars. 2. GIF 30 s trace viewer. | • Merge PR signé par PO. |
| **BUFFER** | **16 SP** | Imprévus & hardening. | — | — |

Total engagé : **44 SP** + 16 SP buffer = 60 SP

---

## 3. Planning Jour → Jour

| Jour | Task ID | Responsable | Livrable | SP |
|------|---------|-------------|----------|----|
| **J1** | TECH‑01, DESIGN review | Tech Lead + Dev B | proto stub + diagram | 2 |
| **J1** | US‑37 (partie mod DB) | Dev A | migration + tests | 2 |
| **J2** | TECH‑02 Docker | Dev B | Image `agent-runtime-py` | 3 |
| **J2‑3** | TECH‑03 client NestJS | Dev A | service & unit tests | 2 |
| **J3** | US‑38 Blocks code | Dev C | 3 Blocks + Storybook | 4 |
| **J3‑4** | US‑39 mapping | Dev A | parser update | 3 |
| **J4** | TECH‑04 metering | Dev B | Redis pub/sub + quota | 3 |
| **J4** | TECH‑05 OTEL | DevOps | spans + dashboard | 2 |
| **J5** | QA‑01 Playwright | QA | green test | 2 |
| **J5** | DOC‑01 README | Dev C | wiki page | 1 |
| **J6‑8** | Buffer / Bug‑fix | All | TBD | 6 |
| **J9** | Sprint Review Démo | Équipe | vidéo Loom | 3 |
| **J10** | Rétro + Plan Sprint 7 | Équipe | sprint backlog | 3 |

---

## 4. Risques & Mitigations
* **Latence gRPC Py > 1 s** → activer streaming + keep‑alive.  
* **Coût token > 20 € / démo** → limiter `max_tokens=512`, alerte Grafana.  
* **Instabilité SDK (0.3.x)** → lock version, tests contract.

---

## 5. Definition of Done
1. Commande `pnpm e2e` passe, incluant flow agent.  
2. Trace Jaeger affiche 3 spans (Node, gRPC, Py) corrélés.  
3. Stripe usage record créé pour chaque run.  
4. Démo vidéo envoyée au marketing.  
5. Rétro documentée – améliorations Sprint 7 listées.

---

_Toute précision ou ajustement → ping moi avant jeudi midi pour re‑estimer._
