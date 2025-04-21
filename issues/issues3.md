# Sprint 3 Issues

## US-07: Alerte Slack erreurs
**Priority**: Must  
**Story Points**: 3  
**Assignees**: Dev A (Interceptor), Dev B (Worker)

**Description**: Capturer les erreurs d’exécution d’agents et envoyer des alertes en temps réel sur Slack.

**Acceptance Criteria**:
1. Un interceptor NestJS intercepte les exceptions et envoie un message dans une queue BullMQ.
2. Un worker BullMQ écoute la queue `alert-slack` et publie un message formaté dans le canal Slack dédié.
3. Tests d’intégration validant l’interception et le dispatcher sur Slack.

---

## US-03: Dashboard ROI (MVP)
**Priority**: Must  
**Story Points**: 8  
**Assignees**: Dev A (Backend), Dev C (Frontend)

**Description**: Fournir un dashboard Web affichant les économies de temps réalisées grâce aux agents.

**Acceptance Criteria**:
1. Schéma de base de données pour stocker les métriques ROI.
2. Job cron (par ex. toutes les heures) agrégeant CA, nouveaux clients, temps économisé.
3. API GET `/metrics/roi` retournant les données agrégées en JSON.
4. Page React `/dashboard` affichant des graphiques via Chart.js.
5. Tests unitaires et d’intégration pour le job et l’API.

---

## NEW-US-17: RGPD Data-Deletion API
**Priority**: Must  
**Story Points**: 3  
**Assignee**: Dev B

**Description**: Implémenter une API DELETE `/users/:id` pour purger les données personnelles conformément au RGPD.

**Acceptance Criteria**:
1. Endpoint documenté via Swagger.
2. Suppression ou anonymisation des enregistrements DB liés à l’utilisateur.
3. Suppression des fichiers S3 associés.
4. Tests d’intégration couvrant le flux happy path et les erreurs.

---

## US-10: Self-Service Upgrade Plan
**Priority**: Must  
**Story Points**: 5  
**Assignee**: Dev A

**Description**: Intégrer le Stripe Customer Portal pour permettre aux clients de changer de plan.

**Acceptance Criteria**:
1. Route API `/billing` renvoyant un link/session Stripe Customer Portal.
2. Front-end charge et affiche le Customer Portal sur la route `/billing`.
3. Test E2E validant le flux de changement de plan.

---

## Tech-Debt: DLQ Console Internal
**Priority**: Should  
**Story Points**: 3  
**Assignee**: Dev B

**Description**: Embeddé l’interface RabbitMQ DLQ pour la supervision interne.

**Acceptance Criteria**:
1. Configuration du plugin RabbitMQ Management.
2. Intégration de la console DLQ en tant que composant/iframe dans le tableau de bord admin.
3. Fonctions de filtrage de messages et d’action de retry disponibles.

---

## Bug-Fix: Slack Token Rotation
**Priority**: Could  
**Story Points**: 2  
**Assignee**: Dev B

**Description**: Mettre en place un cron job pour rafraîchir automatiquement les tokens Slack avant expiration.

**Acceptance Criteria**:
1. Tâche planifiée (cron) s’exécutant quotidiennement pour renouveler les tokens.
2. Tests unitaires validant la logique de rafraîchissement.

