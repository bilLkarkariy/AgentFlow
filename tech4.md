# Tech Spec – Studio Drag‑and‑Drop & Live Execution (Sprint 4)

Version 0.1 – 22 avr 2025

## Scope
Concerne les US suivantes :

| Ref | Titre | SP |
|-----|-------|----|
| NEW‑US‑11 | Studio drag‑and‑drop **minimal** | 8 |
| NEW‑US‑12 | Nodes & edges **avancés** (conditions, boucles) | 8 |
| NEW‑US‑13 | Exécution de **flow** + logs temps‑réel | 5 |

Total : **21 SP** – doit absolument tenir dans la capacité engagée (63 SP).

---

## 1. Vision Produit (rappel)
Permettre à un utilisateur non‑tech de concevoir visuellement un « Agent Flow » : un graphe orienté de **nœuds** (actions) reliés par des **arêtes** (transitions). 
* MVP = CRUD d’un flow, sauvegarde JSON, exécution server‑side, affichage des logs étape par étape.
* Cible persona : **Anne Dupont** (assistante) → simplicité, feedback immédiat.

---

## 2. Architecture Haut‑Niveau
```
[React SPA] ─ WebSocket ──> [API NestJS]
    ▲                       │
    │                       ▼
[React Flow] <— REST —  [/agents/:id/flow]
```
1. React (module *studio*) utilise **React Flow** pour le canvas.
2. Sauvegarde/chargement via REST (AgentsModule ⇢ `AgentFlowController`).
3. Exécution déclenchée via POST `/agents/:id/flow/execute` qui :
   1. Push job dans Bull queue `execute-flow`.
   2. Worker lit chaque node et appelle le connecteur associé.
   3. Publie événements `flow:log` via Redis PubSub.
4. Front ouvre WebSocket (Socket.IO) sur `/ws/flow/:runId` et stream logs.

---

## 3. Front‑end (React)
### 3.1 Librairies
* **reactflow** (MIT, maintenu) + **@reactflow/minimap**.
* Zustand pour state du canvas.
* Tailwind UI components.

### 3.2 Dossier
```
frontend/src/studio/
  ├─ components/
  │   ├─ FlowCanvas.tsx      // wrapper ReactFlow
  │   ├─ Node.*.tsx          // EmailNode, ConditionNode…
  │   └─ Sidebar.tsx         // palette drag‑&‑drop
  ├─ hooks/useFlowStore.ts   // zustand store
  ├─ pages/StudioPage.tsx    // route /studio/:agentId
  └─ api/flows.ts            // fetchers via Axios
```

### 3.3 Node Types (MVP)
| key | UI | Paramètres |
|-----|----|------------|
| `email-send` | ✉️ | to, subject, body |
| `slack-post` | 🟣 | channel, text |
| `condition` | ◻ | expression JS (`ctx.amount > 1000`) |
| `loop-each` | 🔁 | arrayVar |

---

## 4. Backend – Modèle de données
### 4.1 Tables/Migrations (TypeORM)
```
agent_flows (
  id PK, agent_id FK, name, version, created_at, updated_at
)

agent_flow_nodes (
  id PK, flow_id FK, type, config JSONB, pos_x, pos_y
)

agent_flow_edges (
  id PK, flow_id FK, source_node_id, target_node_id, condition_text
)
```
*Index composite on `(flow_id)` for fast load.*

### 4.2 DTO OpenAPI
* `FlowDto` contient `nodes`[] & `edges`[], validé avec `class-validator`.

### 4.3 Endpoints (NestJS)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/agents/:id/flow` | Charger le flow courant |
| PUT | `/agents/:id/flow` | Sauvegarder (remplacement) |
| POST | `/agents/:id/flow/execute` | Exécution ad‑hoc & retourne `runId` |
| WS | `/ws/flow/:runId` | Stream des logs |

Auth : même guard JWT qu’existant `UsersController` + futur RBAC.

---

## 5. Exécution & Logs (US‑13)
1. Endpoint `execute` push un job `execute-flow` avec payload `{ runId, agentId }`.
2. **FlowRunnerService** (Bull consumer)
   1. Charge flow + contexte d’entrée (empty MVP).
   2. Parcourt nodes (DFS) ;
   3. Pour chaque node :
      * Exécute l’action (service EmailService, SlackService…).
      * Émet via Redis `pubClient.publish('flow:log', {...})`.
   4. Termine en publia nt `status: success|error`.
3. **WebSocketGateway** subscribe à Redis & forward aux clients.

*Retry* : si un node échoue ⇒ status error, logs + job `failed`.

### Exemple Event JSON
```json
{
  "runId": "abc123",
  "nodeId": "n1",
  "status": "success",
  "timestamp": 1713779400,
  "message": "Email sent to xyz@corp.com"
}
```

---

## 6. Sécurité & Permissions
* RBAC v0 (NEW‑US‑25) : rôle `editor` peut modifier flow ; `viewer` read‑only.
* WebSocket auth via JWT query param + guard.

---

## 7. Observabilité
* Tracer `execute-flow` Bull jobs via existing **BullBoard** UI.
* Export metrics Prometheus : `agent_flow_node_duration_seconds`.
* Dashboard Grafana (NEW‑US‑20) pour temps moyen par node.

---

## 8. Acceptation / Tests
| Niveau | Outil | Cas |
|--------|-------|-----|
| Unit | Jest | FlowRunnerService, DTO validation |
| Int | Supertest | PUT/GET `/flow` round‑trip |
| e2e | Cypress | Build flow visually, save, execute, see logs |

---

## 9. Risques & Mitigations
* **Courbe React Flow** : plan pair programming J1.
* **Race WS/logs** : utiliser Redis streams si besoin => hors MVP.
* **Complexité Condition/Loop** : Basic JS `eval` sandboxé (vm2) pour Sprint 4; passer à CEL expr. plus tard.

---

## 10. Roadmap Post‑Sprint
* Versioning des flows + rollback.
* Variables d’entrée/sortie & mappage données.
* Marketplace template importer (NEW‑US‑16).
