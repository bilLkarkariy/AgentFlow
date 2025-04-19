# RFC — AgentFlow DSL & Parsing NL

*Status : Draft — Sprint 1 / J1*

## 1. Contexte
Un « agent » AgentFlow doit être défini de façon déclarative (« DSL JSON ») pour être stocké et exécuté par l’orchestrateur. Pour Sprint 1 nous couvrons un cas minimal : déclencheur Gmail + action basique (lire le sujet du dernier email).

## 2. Exemples de prompts NL ➜ DSL
| Prompt NL | DSL JSON |
|-----------|----------|
| « Quand je reçois un email de *alice@example.com*, lis le sujet » | ```json
{
  "name": "Email Alice → Sujet",
  "trigger": {
    "type": "gmail.new_email",
    "filter": { "from": "alice@example.com" }
  },
  "action": {
    "type": "gmail.read_subject",
    "target": "last"
  }
}``` |

## 3. Spécification DSL (0.1)
```jsonc
{
  "name": "string",               // Nom lisible
  "trigger": {
    "type": "gmail.new_email",    // Enum – uniquement ce type au Sprint 1
    "filter": {
      "from": "string"            // Filtre simplifié sur expéditeur
    }
  },
  "action": {
    "type": "gmail.read_subject",  // Enum – action unique Sprint 1
    "target": "last"               // Paramètres spécifiques à l’action
  }
}
```

Contraintes :
* Toutes les clés non listées sont interdites (validation stricte)
* Taille < 8 KB pour stockage Postgres JSONB

## 4. Parsing NL — Options
1. **Heuristique regex / spaCy** :
   - Avantage : local, pas de coût API.
   - Suffisant pour prompts très contraints.
2. **LLM (OpenAI GPT‑4.1 Mini) via openai SDK (LangChain facultatif)** :
   - Prompt engineering pour générer JSON directement.
   - Coût : ~$0.40/1M tokens entrée, $1.60/1M tokens sortie (avril 2025).
   - Latence modérée, qualité > heuristique pour prompts complexes.

Décision : **Option 1** pour Sprint 1 (rapidité, offline). LLM « GPT‑4.1 Mini » sera exploré Sprint 2.

## 5. Questions ouvertes
* Faut‑il prévoir plusieurs actions séquencées ? (hors scope Sprint 1)
* Gestion i18n des prompts ? (français / anglais)

## 6. Roadmap d’implémentation
1. Valider ce DSL avec l’équipe (deadline J1 fin de journée).
2. Implémenter parser `dsl-parser.ts` (NestJS service) basé sur regex/spaCy‑fr.
3. Ajouter validation `class-validator` sur DTO.
4. Stocker DSL (JSONB) dans entité `Agent`.

---
*Auteur : Tech Lead (@you) — 19 avr 2025*

## Annexe A — Intégration GPT‑4.1 Mini (Node.js)

```bash
# Install deps
npm install openai dotenv --save
```

```ts
// gpt-client.ts
import 'dotenv/config';
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askGpt(prompt: string) {
  const chat = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
  });
  return chat.choices[0].message.content;
}
```

Cette annexe suit le tutoriel fourni par l’équipe produit pour une future intégration.
