# Document de Spécifications Fonctionnelles & Techniques  
## AgentFlow PME  
### Version 1.2 — 19 avril 2025  

### Table des matières  
1. Introduction et Vue d’Ensemble  
2. Stratégie de Monétisation  
3. Objectifs  
4. Audience Cible & Personas  
5. Cas d’Usage (Use Cases)  
6. Fonctionnalités (Spécifications Fonctionnelles)  
7. Considérations UX/UI  
8. Exigences Non Fonctionnelles  
9. Critères de Publication & Métriques  
10. Feuille de Route  
11. Spécifications Techniques  
12. User Stories  
13. Annexes  

---

## 1. Introduction et Vue d’Ensemble  
AgentFlow PME est une plateforme SaaS low‑code/no‑code 100 % française qui permet aux TPE/PME de créer rapidement des « Agents IA » pour automatiser leurs processus répétitifs : lecture et validation de factures, support client de premier niveau, reporting, opérations RH simples, etc.  

### 1.1 Problème  
Les petites entreprises manquent de temps, de budget et de compétences techniques pour mettre en place des solutions RPA ou IA complexes. Elles gèrent encore beaucoup de tâches manuelles à faible valeur ajoutée.  

### 1.2 Vision  
Démocratiser l’automatisation intelligente : offrir une solution abordable, en français, hébergée en Europe, utilisable sans coder, pour libérer du temps et augmenter la productivité des PME.  

---

## 2. Stratégie de Monétisation  
### 2.1 Tiers d’abonnement (mensuel, –10 % sur engagement 12 mois)  
| Plan | Prix (€ HT) | Agents inclus | Tâches/mois | Connecteurs | SLA | Support |
|------|------------|--------------|-------------|-------------|-----|---------|
| **Essentiel** | 49 € | 2 | 500 | 3 natifs | 99,5 % | Ticket 48 h |
| **Croissance** | 149 € | 10 | 5 000 | Tous natifs | 99,9 % | Chat 12 h |
| **Pro** | 279 € | Illimité | 30 000 | Premium inclus | 99,95 % | Téléphone 4 h |
| **Élite Entreprise** | **899 €** | Illimité | 100 000 | Premium + connecteurs dédiés | 99,995 % | TAM 24/7 & Slack Connect |

> **Élite** inclut hébergement VPC dédié/on‑prem, SAML/SCIM, audit RGPD annuel, accès bêta, 500 000 appels API REST/mois (0,001 €/appel supplémentaire).  

### 2.2 Add‑ons  
* Packs 5 000 tâches : 29 € / pack  
* Connecteur premium (ERP, PPF/PDP…) : 19 €/mois  
* SLA étendu 99,99 % : 99 €/mois  
* API publique au‑delà du quota : 0,002 €/appel  

### 2.3 Marketplace d’agents & templates  
Commissions : 30 % AgentFlow / 70 % créateur. Validation qualité & sécurité obligatoire.  

### 2.4 Services professionnels  
* Pack Décollage (3 agents + formation 4 h) : 799 € one‑shot  
* Audit & Optimisation trimestriel : 1 499 €  

---

## 3. Objectifs  
### 3.1 Commerciaux  
* MRR 100 k€ à M+24 (avril 2027)  
* ARPU moyen : 130 €/PME  
* Churn < 3 %/mois — Expansion MRR ≥ 20 %  

### 3.2 Produit  
* Réduction ≥ 30 % du temps sur tâches automatisées  
* NPS > 40  

### 3.3 Stratégiques  
* Être la référence française de l’automatisation accessible  
* Alignement sur IA agentique et LCNC  

---

## 4. Audience Cible & Personas  
### 4.1 Audience principale  
* TPE (1‑9 salariés) & PME (10‑249) en France, secteurs : services, commerce, BTP, artisanat, conseil.

### 4.2 Personas clés
- **Sophie Dubois** — Gérante d’une agence de communication (20 employés)
  * Compétences numériques de base, pas technique
  * Objectifs : gagner du temps sur factures, relances, support simple
  * Pain points : tâches manuelles répétitives, risque erreur, coût RPA

- **Anne Dupont** — Assistante administrative
  * Objectifs : rationaliser la saisie des factures, automatiser les relances clients et le reporting mensuel
  * Pain points : saisie manuelle chronophage, suivi des échéances dispersé

- **Jean Martin** — Directeur des systèmes d'information
  * Objectifs : sécuriser les flux, garantir RGPD et SLA, centraliser les connecteurs
  * Pain points : complexité technique, manque de ressources pour maintenir plusieurs intégrations

- **Claire Leroy** — Directrice financière d’un groupe multi‑entités
  * Objectifs : consolidation des données comptables, visibilité temps réel sur la trésorerie
  * Pain points : données éparpillées entre services, délais de reporting long

### 4.3 Utilisateurs secondaires
Assistants admin, office managers, responsables de service.

---

## 5. Cas d’Usage  
### UC‑01 — Automatisation du traitement des factures fournisseurs  
« Quand un email arrive avec une facture PDF, extrais champs, rapproche avec le bon de commande dans Pennylane, valide ou alerte. »  

### UC‑02 — Support client de 1er niveau  
Chatbot FAQ 24/7, escalade CRM & Slack.  

### UC‑03 — Rapport mensuel automatisé  
Le 1er du mois, extrait CA, nouveaux clients, top 3 services; envoie PDF par email.  

### UC‑04 — Suivi des congés  
Formulaire ↔️ Google Sheets, mise à jour calendrier, notification approbation.  

---

## 6. Fonctionnalités (FR)  
| Ref | Fonctionnalité | Description |
|-----|----------------|-------------|
| **FR‑01** | Catalogue d’agents pré‑configurés | Bibliothèque plug‑and‑play |
| **FR‑02** | Studio de configuration LCNC | NL + éditeur drag‑and‑drop, test, logs |
| **FR‑03** | Hub de connectivité | Connecteurs natifs : Gmail, Pennylane, Slack, HubSpot… |
| **FR‑04** | Moteur d’exécution | Orchestration cloud, triggers événementiels & planifiés |
| **FR‑05** | Tableau de bord supervision | État agents, historique, activer/désactiver |
| **FR‑06** | Gestion utilisateurs & accès | RBAC simple, MFA optionnel |
| **FR‑07** | Sécurité & Conformité | RGPD, chiffrement, journaux, hosting EU |
| **FR‑08** | Dashboard ROI | Heures & € économisés, export PDF |
| **FR‑09** | Suggestions Next‑Best‑Flow | Recommandations ML d’automatismes |
| **FR‑10** | Multi‑société & White‑label | Comptes multi‑entités, branding custom |
| **FR‑11** | SLA & Support premium | Monitoring, TAM, hotline 24/7 |

---

## 7. Considérations UX/UI  
* Interface épurée, 100 % français  
* Onboarding interactif pas‑à‑pas  
* Compteur de tâches consommées (gamification)  
* Bannières d’upsell contextuelles  
* Conformité WCAG & responsive  

---

## 8. Exigences Non Fonctionnelles  
| Domaine | Cible |
|---------|-------|
| Performance | Latence trigger < 5 s, tâche simple < 10 s | 
| Scalabilité | +10× utilisateurs sans dégradation |
| Fiabilité | Disponibilité ≥ 99,9 % (Essentiel) / 99,995 % (Élite) |
| Sécurité | RGPD, TLS 1.3, AES‑256, MFA, Pentest annuel |
| Utilisabilité | Config agent ≤ 15 min utilisateur non‑tech |
| Maintenabilité | Architecture micro‑services, CI/CD automatisé |

---

## 9. Critères de Publication & Métriques  
* MVP live avec UC‑01–03, connecteurs Gmail, Pennylane, Slack  
* KPI : activation ≥ 60 %, conversion essai → payant ≥ 35 %, exécution réussie ≥ 97 %  
* KPI Plan Élite : ≥ 5 % du MRR fin Y2  

---

## 10. Feuille de Route  
| Trimestre | Livraison | Impact |
|-----------|-----------|--------|
| **Q3 2025** | Marketplace + connecteurs premium | ARPU ↑ |
| **Q4 2025** | GA Plan Élite, White‑label cabinets | Acquisition indirecte |
| **Q1 2026** | App mobile + Next‑Best‑Flow AI | Rétention & expansion |

---

## 11. Spécifications Techniques  
### 11.1 Architecture haute‑niveau  
```
[Client Web] ──HTTPS──> [Front‑end SPA React]              
                              │ REST/JSON                 
[Mobile App] ────────────────>│                          
                              ▼                          
                     [API Gateway ‑ NestJS]               
                              │ REST                      
                              ▼                          
                      ┌────────── Micro‑services ─────────┐
                      │ Auth & RBAC (Keycloak)            │
                      │ Agent Orchestrator (Python + Celery)
                      │ Connecteurs (Node)                │
                      │ Metrics Service (Go)              │
                      └───────────────────────────────────┘
                              │ RabbitMQ                  
                              ▼                          
                         [PostgreSQL] (meta) & [MinIO]    
```
### 11.2 Pile technologique  
| Couche | Tech | Motif |
|--------|------|-------|
| Front‑end | React 18, Tailwind, Vite | SPA perf & themeable |
| Mobile | React‑Native Expo | Code‑share UI |
| API | NestJS, REST, TypeORM | Structuré, DI |
| Agents | Python 3.12, FastAPI, Celery | Écosystème IA |
| Queue | RabbitMQ | Fiable & persistant |
| DB | PostgreSQL 16 | ACID, JSONB logs |
| Objet | MinIO | S3‑compatible EU |
| Container | Docker, K8s (local & cloud‑agnostic) | HPA |
| CI/CD | GitHub Actions → ArgoCD | GitOps |
| Observabilité | Prometheus, Grafana, Loki | Metrics & logs |
| Secrets | HashiCorp Vault | Rotation |

### 11.3 Connecteurs  
Pattern micro‑service stateless, OAuth2 via API Gateway, refresh token chiffré (Vault Transit). Stubs pour mode Test.  

### 11.4 Moteur d’exécution  
DSL JSON généré par LLM, limité à 30 s CPU Essentiel / 120 s Pro+, retry expo 3×, DLQ.  

### 11.5 Sécurité  
Hosting France (Provider‑agnostic, Gravelines), chiffrement at‑rest AES‑256, logs immuables ( WORM).  

### 11.6 Observabilité  
Dashboards MTTR, quotas, erreurs. Alertmanager vers PagerDuty (Pro+) ou Slack (Élite).  

### 11.7 Tests  
Unit 80 %, intégration UC‑01–04, E2E Playwright nightly, perf k6 ≥ 1 000 agents/nœud.  

---

## 12. User Stories  
| ID | En tant que | Je veux | Afin de | Priorité |
|----|-------------|--------|---------|----------|
| US‑01 | Sophie Dubois | créer un agent NL pour traiter les factures | gagner 2 h/semaine | Must |
| US‑02 | Assistant admin | tester un agent avec données d’exemple | valider son comportement | Must |
| US‑03 | Sophie | voir le ROI temps/€ | prouver la valeur | Should |
| US‑04 | PME multi‑entités | gérer plusieurs sociétés | centraliser | Should |
| US‑05 | DSI (Élite) | provisionner via SCIM | respecter IAM | Could |
| US‑06 | Cabinet comptable | revendre en white‑label | créer revenu | Could |
| US‑07 | Sophie | alerte Slack après 3 échecs | réagir vite | Must |
| US‑08 | Support AgentFlow | voir la DLQ | relancer tâches | Int |
| US‑09 | Analyste produit | suivre quotas plan | upsell | Int |
| US‑10 | Utilisateur Essentiel | upgrader en un clic | lever limites | Must |

---

## 13. Annexes  
* **A. Modèle de données simplifié**  
* **B. Matrice CRUD**  
* **C. Glossaire des acronymes**  

*(Fin du document v1.2 complet)*
