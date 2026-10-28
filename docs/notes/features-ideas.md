# Feature / AgentBlock Ideas

> Draft list for backlog grooming (Sprint 9+)

| ID | Idea | Description / Use‑Case | Estimated Effort | Priority (persona) |
|----|------|-----------------------|------------------|--------------------|
| FI‑01 | Code Interpreter Block | Exécute du Python (pandas, matplotlib) en sandbox pour générer rapports, transformer CSV → JSON, etc. | 8 SP | High (Anne, Claire) |
| FI‑02 | Vision OCR Upgrade | Ajouter GPT‑4o + vision à `InvoiceExtractor` pour extraire champs depuis PDF/images. | 5 SP | High (Anne) |
| FI‑03 | Retrieval QA Block | RAG sur documents MinIO (FAISS / pgvector) ; réponds aux questions docs comptables. | 5 SP | Medium (Jean, Claire) |
| FI‑04 | Audio Transcription Block | Utilise Whisper pour transcrire réunions et messages vocaux ; retourne SRT. | 4 SP | Medium (Anne) |
| FI‑05 | Spreadsheet Writer Block | Écrit KPIs dans Google Sheets / Excel 365 via OAuth. | 5 SP | Medium (Claire) |
| FI‑06 | Email Automation Block | Lecture + routage emails entrants, tagging automatique. | 6 SP | Medium (Anne) |
| FI‑07 | DALL·E Visual Block | Génère illustrations pour emails/rapports. | 3 SP | Low |
| FI‑08 | Voice Conversation Agent | Interface vocale temps‑réel WebRTC ; assistant parlé. | 8 SP | Low |
| FI‑09 | Agent Confidentialité Données | Surveille flux, anonymise, rapports GDPR. | 6 SP | High (légal) |
| FI‑10 | Créateur de flux langage naturel | Décrit un automatisme en NL ; l’IA génère le flow. | 8 SP | High (non‑tech) |
| FI‑11 | Chatbot Block | Chatbot support/lead gen avec RAG + actions. | 5 SP | High (client‑facing) |
| FI‑12 | Analyse de sentiment | Analyse feedback clients, réseaux sociaux. | 4 SP | Medium (marketing) |
| FI‑13 | Génération de contenu | Rédige emails, rapports, posts. | 5 SP | Medium (comms) |
| FI‑14 | Créateur visuel IA | Génère images/graphismes marketing. | 6 SP | Medium (design) |
| FI‑15 | Agent scoring leads | Priorise prospects via data scoring. | 5 SP | High (sales) |
| FI‑16 | Optimiseur d’inventaire | Prévoit stock et automatise commandes. | 7 SP | High (logistique) |
| FI‑17 | Vérificateur conformité GDPR | Analyse flux, données → conformité. | 6 SP | High (legal) |
| FI‑18 | Collaboration temps réel | Co‑édition de flows + suggestions IA. | 8 SP | Medium (teams) |
| FI‑19 | Créateur de Blocks personnalisés | UI visuelle pour builder un Block. | 10 SP | Low (power users) |
| FI‑20 | Maintenance prédictive | Anticipe pannes équipements IoT. | 7 SP | High (manufacture) |
| FI‑21 | Nettoyage automatique données | Détecte/corrige erreurs datasets. | 5 SP | Medium (data) |
| FI‑22 | Interface commandes vocales | Contrôle des flows par voix. | 6 SP | Medium (UX) |
| FI‑23 | Assistant planification | Planifie réunions/tâches selon agenda. | 5 SP | High (managers) |
| FI‑24 | Bloc traduction multilingue | Traduction auto texte multi‑langues. | 4 SP | Medium (intl) |
| **Section : Agent Blocks avancés** |  |  |  |  |
| FI‑25 | Agent Customer Follow‑Up | Envoie séquences d’emails + relance factoring clients. | 5 SP | High (Anne) |
| FI‑26 | Agent Data Enrichment | Enrichit contacts via API (Clearbit, Social). | 4 SP | Medium (sales) |
| FI‑27 | Agent Cashflow Forecast | Analyse transactions, prédit trésorerie 30 j. | 7 SP | High (Claire) |
| FI‑28 | Agent Compliance Watcher | Surveille flux pour violations GDPR / TVA. | 6 SP | High (Jean) |
| FI‑29 | Agent Invoice Chaser | Détecte factures en retard et envoie relances multi‑canal. | 5 SP | High (Anne) |
| FI‑30 | Agent Stock Replenisher | Surveille stock, crée bon de commande automatique. | 7 SP | High (retail) |
| FI‑31 | Agent Meeting Minutes | Prend audio + génère compte‑rendu actionnable. | 4 SP | Medium (managers) |
| FI‑32 | Agent Security Sentinel | Analyse logs, signale comportements anormaux. | 6 SP | Medium (DSI) |
| FI‑33 | Agent Doc Processor | OCR+NLP pour contrats/factures ; extraction & résumé. | 5 SP | High (opérations) |
| FI‑34 | Agent Social Media Manager | Analyse tendances, planifie & publie contenu, répond aux mentions. | 5 SP | Medium (marketing) |
| FI‑35 | Agent Project Planner | Planifie, suit tâches, prédit risques & ressources. | 6 SP | Medium (opérations) |
| FI‑36 | Agent Web Interactor | Exécute actions web (formulaires, scraping) sans API. | 7 SP | Medium (divers) |
| FI‑37 | Agent Fraud Detector | Analyse transactions, détecte anomalies/fraude. | 6 SP | High (finance) |

## Next Steps
1. Évaluer risques sécurité (Code Interpreter, Email, Voice).  
2. Prototyper FI‑01 dans un env sandbox Docker.  
3. Collecter feedback des personas sur la valeur perçue.  
4. Prioriser pour Sprint 9 planning.
