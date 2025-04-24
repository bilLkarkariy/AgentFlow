---
title: "ADR: Agent Framework Selection (2025-04)"
date: 2025-04-23
status: accepted
---

## Context
Le pivot vers une architecture multi-agents nécessite un moteur robuste, extensible et intégré à notre monorepo NestJS. Un spike a comparé LangGraph et CrewAI.

## Decision
Choix de **CrewAI** comme framework principal pour la création de nos AgentBlocks IA.

### Justifications
- Orchestration native multi-agents et workflows avancés.
- Observabilité intégrée (OpenTelemetry, dashboard UI).
- SDK Python & TypeScript pour une intégration rapide.
- Communauté active et support commercial de CrewAI.

## Consequences
- Implémentation initiale via micro-service Python `agent-runtime` avec gRPC.
- Préparation d’un SDK JS pour migration vers TypeScript en fin Sprint 6.
- Mise à jour de la documentation (PRD, README).
