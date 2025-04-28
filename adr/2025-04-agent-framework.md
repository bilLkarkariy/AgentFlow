---
title: "ADR: Agent Framework Selection (2025-04)"
date: 2025-04-23
status: accepted
---

## Context
Le pivot vers une architecture multi-agents nécessite un moteur robuste, extensible et intégré à notre monorepo NestJS. Un spike a comparé LangGraph, CrewAI et OpenAI Agent SDK.

## Decision
Choix de **OpenAI Agent SDK** comme framework principal pour la création de nos AgentBlocks IA.

### Justifications
- Support natif des modèles avancés GPT-4o et o4-mini.
- Orchestration multi-agents et outils intégrés (function calling).
- Performance supérieure et coûts optimisés.
- Documentation complète et roadmap claire d'OpenAI.

## Consequences
- Intégration directe via notre service `agent-runtime` avec API REST/gRPC.
- Réduction de la complexité d'infrastructure (pas de dépendance Python).
- Mise à jour des métriques de coûts pour tracking précis par agent.
- Mise à jour de la documentation (PRD, README).
