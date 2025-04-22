# UX Workshop – Studio & Copilot IA (Sprint 4 Bonus)

Transcription simulée d’une session brainstorming entre :
* **Lucie** (Product Designer)
* **Baptiste** (Product Manager)
* **Alex** (Tech Lead)

---

## 1. Ice‑breaker
> **Lucie** : *« Je veux que l’utilisateur ait l’impression de manipuler du Lego digital. »*
> **Baptiste** : *« Et qu’un assistant IA l’aide à assembler les briques. »*
> **Alex** : *« Il faut que la complexité technique reste sous le tapis et que la performance suive. »*

---

## 2. Objectif
1. Concevoir un **Studio** visuel clean (drag‑and‑drop React Flow).  
2. Ajouter un **Copilot IA** (chat) capable de générer ou modifier le flow JSON.  
3. Fournir un **feedback en temps‑réel** par WebSocket lors de l’exécution.

---

## 3. Parcours Utilisateur (Happy Path)
1. **Ouverture Studio** : l’agent n’a pas encore de flow → page “empty state” avec CTA « Commencer » ou chat Copilot.
2. **Demande NL** : *« Quand je reçois un email avec facture supérieure à 500 €, créer brouillon Pennylane et notifier Slack. »*
3. **Copilot** : GPT‑4o propose un plan ; crée instantanément les 3 nœuds et les connecte.  
4. **Canvas** se met à jour ; l’utilisateur visualise le flow.  
5. **Édition fine** : drag & drop, modif champ “amount > 500”.
6. **Test Run** : bouton ▶️ → exécute flow sur données factice. Logs stream à droite.

---

## 4. Wireframes (texte)
```
+-------------------------------------------------------------+
|  Header (Agent name • status • Save)                        |
+------------------+------------------------------+----------+
|  Sidebar Nodes   | Canvas (React Flow)          |  Panel   |
|  - Email Send    |                              |  - Chat  |
|  - Slack Post    |   [  Node  ]-->[ Node  ]     |    GPT   |
|  - Condition     |        \                    |  - Logs  |
|  - Loop          |         >[ Node ]            |          |
+------------------+------------------------------+----------+
```
* Panel right = **tabs** Chat / Logs / Props.

---

## 5. Copilot IA – Interaction Design
### 5.1 Flow
1. Textarea chat + bouton Send.  
2. On Send : front POST `/ai/copilot` `{ text, currentFlow }`.
3. API Gateway appelle OpenAI GPT‑4 (function calling) avec schema Flow JSON.  
4. Renvoie `{ diff }` ou `{ newFlow }`.
5. Front applique patch (otpimistic UI) puis affiche confirmation.

### 5.2 Guidelines NLP
* Encourager phrases courtes.  
* Auto‑suggestions (chips) : “Envoyer email”, “Ajouter condition”.

---

## 6. Patterns UI
| Pattern | Justification |
|---------|---------------|
| **Empty State + Illustration** | Onboarding rapide |
| **Inline validation** dans side‑panel | Eviter modals |
| **Ghost arrows** lors du drag | Feedback clair |
| **Keyboard ⌘+S** save | Power‑users |
| **Logs coloured** (✓,⚠︎,✗) | Debug rapide |

---

## 7. Accessibilité & i18n
* Contrastes WCAG AA, focus visible.  
* Langue par défaut FR, UI ready for l10n.

---

## 8. Tech Constraints & API
* WebSocket déjà prévu pour logs (`/ws/flow/:runId`).  
* Copilot : limiter à 30 sec, retry / abort.  
* Rate‑limit chat 20 req/min/user.

---

## 9. Mesure de Succès
| KPI | Cible |
|-----|-------|
| Temps moyen `first_flow_created` | < 3 min |
| % d’actions créées via Copilot | ≥ 40 % |
| CSAT Studio | > 4,2/5 |

---

## 10. Prochaines Étapes
1. Prototype Figma (Lucie) – prêt J+2.  
2. Valider prompts GPT‑4o (Baptiste+Alex).  
3. PoC “copilot → React Flow diff” (Alex) – J+4.
