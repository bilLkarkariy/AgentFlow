Tutoriel Complet sur le SDK OpenAI Agents (openai-agents-python)
1. Introduction

Le SDK OpenAI Agents est une bibliothèque Python légère conçue pour faciliter la création d'applications basées sur des agents IA. Il fournit des composants de base simples mais puissants, minimisant l'abstraction pour vous donner un contrôle maximal.

Pourquoi utiliser le SDK Agents ?

Léger et Pythonique : S'intègre naturellement avec Python, peu de nouvelles abstractions à apprendre.

Focalisé sur les Agents : Conçu spécifiquement pour construire des flux d'agents.

Composants Clés :

Agents : Un LLM configuré avec des instructions et des outils.

Handoffs : Permet aux agents de déléguer des tâches à d'autres agents spécialisés.

Guardrails : Mécanismes pour valider les entrées/sorties et contrôler le flux d'exécution.

Outils (Tools) : Permettent aux agents d'interagir avec le monde extérieur (fonctions Python, API, recherche web, etc.).

Traçage Intégré : Pour visualiser, déboguer et surveiller vos workflows, compatible avec les outils d'évaluation et de fine-tuning d'OpenAI.

Flexibilité : Facile à démarrer, mais hautement configurable pour des cas d'utilisation avancés.

2. Installation et Configuration Initiale
a. Créer un Projet et un Environnement Virtuel
mkdir mon_projet_agent
cd mon_projet_agent
python -m venv .venv

b. Activer l'Environnement Virtuel

(À faire à chaque nouvelle session de terminal)

# macOS / Linux
source .venv/bin/activate

# Windows (Git Bash)
source .venv/Scripts/activate

# Windows (CMD/PowerShell)
# .venv\Scripts\activate.bat  (CMD)
# .venv\Scripts\Activate.ps1 (PowerShell - peut nécessiter Set-ExecutionPolicy RemoteSigned)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
c. Installer le SDK Agents
pip install openai-agents
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

(Facultatif) Pour utiliser les fonctionnalités vocales ou de visualisation :

pip install "openai-agents[voice]"  # Pour les agents vocaux
pip install "openai-agents[viz]"   # Pour la visualisation de graphes
pip install "openai-agents[litellm]" # Pour utiliser d'autres modèles via LiteLLM
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
d. Configurer la Clé API OpenAI

Le SDK recherche par défaut la variable d'environnement OPENAI_API_KEY.

export OPENAI_API_KEY=sk-votrecléapi...
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Si vous ne pouvez pas définir la variable d'environnement, vous pouvez la définir programmatiquement au début de votre script (avant toute utilisation du SDK) :

from agents import set_default_openai_key

set_default_openai_key("sk-votrecléapi...")
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
3. Concepts Fondamentaux : Créer et Exécuter un Agent Simple
a. Définir un Agent

Un Agent est le bloc de construction principal. Il combine un LLM avec des instructions et potentiellement des outils.

from agents import Agent

# Création d'un agent simple sans outils
assistant_agent = Agent(
    name="Assistant IA",
    instructions="Tu es un assistant IA serviable. Réponds de manière concise et polie."
    # model="gpt-4o-mini" # Par défaut, gpt-4o est utilisé si non spécifié
)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

name: Nom unique de l'agent (utilisé pour le traçage et les handoffs).

instructions: Le "system prompt" qui guide le comportement de l'agent.

b. Exécuter l'Agent

La classe Runner est utilisée pour exécuter les agents.

from agents import Agent, Runner
import asyncio # Requis pour les opérations asynchrones

assistant_agent = Agent(
    name="Assistant Haiku",
    instructions="Tu es un assistant IA poétique. Réponds toujours sous forme de haïku."
)

async def main():
    # Exécution asynchrone (recommandée)
    result = await Runner.run(
        starting_agent=assistant_agent,
        input="Écris un haïku sur la programmation."
    )
    print("--- Résultat Async ---")
    print(result.final_output) # Accède à la sortie finale

# --- Alternative Synchrone ---
# Attention: Ne fonctionne pas dans un environnement déjà asynchrone (ex: Jupyter, FastAPI)
# result_sync = Runner.run_sync(
#     starting_agent=assistant_agent,
#     input="Écris un haïku sur la programmation."
# )
# print("\n--- Résultat Sync ---")
# print(result_sync.final_output)

if __name__ == "__main__":
    asyncio.run(main())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

Runner.run(): Exécute l'agent de manière asynchrone.

Runner.run_sync(): Exécute l'agent de manière synchrone (utilise asyncio.run() en interne).

starting_agent: L'agent par lequel le workflow commence.

input: L'entrée initiale pour l'agent (un message utilisateur simple ici).

result.final_output: Contient la réponse finale de l'agent (ou du dernier agent après handoffs).

c. La Boucle de l'Agent

Lorsque vous appelez Runner.run(), une boucle s'exécute :

Le LLM de l'agent actuel est appelé avec l'historique de la conversation.

Le LLM génère une sortie :

Sortie Finale : Si la sortie correspond au output_type attendu (ou str par défaut) et qu'il n'y a pas d'appels d'outils/handoffs, la boucle se termine, et cette sortie est retournée.

Appel d'Outil : Si le LLM décide d'utiliser un outil, l'outil est exécuté, son résultat est ajouté à l'historique, et la boucle recommence (le LLM est rappelé avec le résultat de l'outil).

Handoff : Si le LLM appelle un outil de handoff, l'agent actuel change, et la boucle recommence avec le nouvel agent.

La boucle s'arrête aussi si le nombre maximal de tours (max_turns) est dépassé (provoquant une exception MaxTurnsExceeded).

4. Utilisation des Outils (Tools)

Les outils permettent aux agents d'interagir avec le monde extérieur ou d'effectuer des actions spécifiques.

a. Outils Fonctions (@function_tool)

Le moyen le plus simple de créer un outil est de décorer une fonction Python.

from agents import Agent, Runner, function_tool
import asyncio
import random

# Définir une fonction Python comme outil
@function_tool
def get_meteo(ville: str) -> str:
    """Récupère la météo pour une ville donnée."""
    print(f"[Debug] Appel de get_meteo pour : {ville}")
    meteo_possible = ["ensoleillé", "nuageux", "pluvieux", "neigeux"]
    return f"La météo à {ville} est {random.choice(meteo_possible)}."

# Créer un agent qui peut utiliser cet outil
agent_meteo = Agent(
    name="Agent Météo",
    instructions="Tu es un assistant météo. Utilise l'outil 'get_meteo' si nécessaire.",
    tools=[get_meteo] # Passer la fonction décorée à la liste d'outils
)

async def main_meteo():
    result = await Runner.run(
        starting_agent=agent_meteo,
        input="Quel temps fait-il à Paris ?"
    )
    print(result.final_output)

    # Afficher les détails de l'exécution (pour le débogage)
    # print("\n--- Détails de l'exécution ---")
    # print(result) # Affiche l'objet RunResult complet

if __name__ == "__main__":
    asyncio.run(main_meteo())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

Le décorateur @function_tool transforme get_meteo en un FunctionTool.

Le nom de l'outil est le nom de la fonction (get_meteo).

La description de l'outil est extraite du docstring.

Les paramètres (ville: str) et leur type sont automatiquement utilisés pour générer le schéma JSON attendu par le LLM.

L'agent est informé de l'outil via le paramètre tools. Le LLM décidera quand l'appeler.

b. Outils Hébergés (Hosted Tools)

OpenAI fournit des outils pré-hébergés (principalement avec l'API Responses) :

WebSearchTool(): Recherche web.

FileSearchTool(vector_store_ids=["vs_123"]): Recherche dans des Vector Stores OpenAI.

ComputerTool(): Automatisation d'actions sur ordinateur (nécessite une configuration spécifique).

# Exemple (nécessite l'API Responses et potentiellement une configuration supplémentaire)
from agents import Agent, WebSearchTool, FileSearchTool

agent_recherche = Agent(
    name="Chercheur",
    instructions="Utilise la recherche web et fichiers pour répondre aux questions.",
    tools=[
        WebSearchTool(),
        FileSearchTool(vector_store_ids=["vs_abc123"]) # Remplacez par votre ID de Vector Store
    ]
    # model="gpt-4o" # Assurez-vous d'utiliser un modèle compatible
)
# ... exécution via Runner ...
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
c. Agents comme Outils

Un agent peut être transformé en outil pour être appelé par un autre agent sans handoff complet.

from agents import Agent, Runner
import asyncio

agent_espagnol = Agent(
    name="Traducteur Espagnol",
    instructions="Traduis le message de l'utilisateur en espagnol.",
    model="gpt-4o-mini"
)

agent_orchestrateur = Agent(
    name="Orchestrateur de Traduction",
    instructions="Utilise les outils de traduction fournis pour répondre à la demande.",
    tools=[
        agent_espagnol.as_tool(
            tool_name="traduire_en_espagnol",
            tool_description="Traduit le message fourni en espagnol."
        )
        # Ajoutez d'autres agents/outils ici si nécessaire
    ],
    model="gpt-4o-mini"
)

async def main_agent_outil():
    result = await Runner.run(
        starting_agent=agent_orchestrateur,
        input="Comment dit-on 'Bonjour, comment vas-tu ?' en espagnol ?"
    )
    print(result.final_output)

if __name__ == "__main__":
   asyncio.run(main_agent_outil())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
5. Handoffs : Déléguer entre Agents

Les handoffs permettent de créer des systèmes multi-agents où chaque agent est spécialisé. Un agent "triage" peut router la conversation vers l'agent approprié.

from agents import Agent, Runner, handoff
import asyncio

# --- Agents Spécialisés ---
agent_maths = Agent(
    name="Tuteur Maths",
    handoff_description="Spécialiste pour les questions de mathématiques.",
    instructions="Tu aides avec les problèmes de maths. Explique ton raisonnement étape par étape.",
    model="gpt-4o-mini"
)

agent_histoire = Agent(
    name="Tuteur Histoire",
    handoff_description="Spécialiste pour les questions d'histoire.",
    instructions="Tu aides avec les requêtes historiques. Explique clairement les événements importants.",
    model="gpt-4o-mini"
)

# --- Agent Triage ---
# Option 1: Handoff simple (le nom et la description sont générés automatiquement)
agent_triage = Agent(
    name="Agent Triage Devoirs",
    instructions="Détermine quel tuteur (Maths ou Histoire) doit répondre à la question de l'utilisateur.",
    handoffs=[agent_maths, agent_histoire], # Liste des agents vers lesquels on peut faire un handoff
    model="gpt-4o-mini"
)

# Option 2: Handoff personnalisé (contrôle du nom/description de l'outil handoff)
# from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
# agent_triage_custom = Agent(
#     name="Agent Triage Devoirs Custom",
#     instructions=f"{RECOMMENDED_PROMPT_PREFIX}\nDétermine quel tuteur (Maths ou Histoire) doit répondre.",
#     handoffs=[
#         handoff(agent_maths, tool_name_override="transfert_vers_maths"),
#         handoff(agent_histoire, tool_description_override="Délègue à l'expert en histoire.")
#     ],
#     model="gpt-4o-mini"
# )

async def main_handoff():
    print("--- Test Handoff Histoire ---")
    result_hist = await Runner.run(
        starting_agent=agent_triage,
        input="Qui était le premier président des États-Unis ?"
    )
    print(f"Agent final: {result_hist.last_agent.name}") # Affiche 'Tuteur Histoire'
    print(f"Réponse: {result_hist.final_output}")

    print("\n--- Test Handoff Maths ---")
    result_math = await Runner.run(
        starting_agent=agent_triage,
        input="Comment résoudre 2x + 3 = 11 ?"
    )
    print(f"Agent final: {result_math.last_agent.name}") # Affiche 'Tuteur Maths'
    print(f"Réponse: {result_math.final_output}")

if __name__ == "__main__":
   asyncio.run(main_handoff())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

L'agent agent_triage a une liste handoffs contenant les agents spécialisés.

Le SDK crée automatiquement des outils nommés transfer_to_tuteur_maths et transfer_to_tuteur_histoire.

Les handoff_description des agents spécialisés sont utilisées pour la description de ces outils de handoff.

Le LLM de l'agent triage choisit l'outil de handoff approprié en fonction de l'input.

result.last_agent indique quel agent a fourni la réponse finale.

6. Gestion du Contexte

Le contexte permet de partager des informations et des dépendances entre les différentes parties de votre workflow (agents, outils, hooks).

a. Contexte Local (RunContextWrapper)

C'est un objet Python que vous créez et passez à Runner.run(). Il est accessible dans les fonctions d'outils, les hooks, etc., mais n'est pas envoyé au LLM. Utile pour l'injection de dépendances (loggers, BDD) ou le passage d'informations spécifiques à l'exécution (ID utilisateur, etc.).

from agents import Agent, Runner, function_tool, RunContextWrapper
from dataclasses import dataclass
import asyncio

@dataclass
class ContexteUtilisateur:
    nom: str
    id_utilisateur: int
    est_premium: bool = False

# L'outil reçoit le contexte wrappé
@function_tool
async def get_infos_utilisateur(wrapper: RunContextWrapper[ContexteUtilisateur]) -> str:
    """Récupère des informations formatées sur l'utilisateur actuel."""
    user_ctx = wrapper.context # Accède à l'objet ContexteUtilisateur
    statut = "Premium" if user_ctx.est_premium else "Standard"
    return f"Utilisateur: {user_ctx.nom} (ID: {user_ctx.id_utilisateur}, Statut: {statut})"

# L'agent doit être typé avec le type de contexte
agent_ctx = Agent[ContexteUtilisateur](
    name="Agent Contexte",
    instructions="Utilise l'outil pour obtenir les infos utilisateur.",
    tools=[get_infos_utilisateur]
)

async def main_contexte():
    # Créer l'objet contexte
    mon_contexte = ContexteUtilisateur(nom="Alice", id_utilisateur=123, est_premium=True)

    result = await Runner.run(
        starting_agent=agent_ctx,
        input="Peux-tu me donner les infos de l'utilisateur ?",
        context=mon_contexte # Passer le contexte ici
    )
    print(result.final_output)

if __name__ == "__main__":
   asyncio.run(main_contexte())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
b. Contexte pour le LLM

Le LLM ne voit que l'historique de la conversation (messages utilisateur, réponses assistant, appels d'outils et leurs résultats). Pour lui fournir du contexte :

Instructions de l'Agent : Via le paramètre instructions. Peut être statique ou dynamique (une fonction recevant le RunContextWrapper). Idéal pour des informations générales (nom de l'utilisateur, date).

Input de Runner.run() : Ajoutez des messages système ou utilisateur à la liste d'input initiale.

Outils Fonctions : Le LLM peut appeler un outil pour obtenir des informations à la demande.

Retrieval / Recherche Web : Outils spécifiques (comme FileSearchTool, WebSearchTool) pour récupérer des informations pertinentes de fichiers ou du web.

7. Guardrails : Contrôler le Flux

Les Guardrails exécutent des vérifications en parallèle de l'agent. Ils peuvent interrompre l'exécution si une condition est remplie (tripwire).

Input Guardrails : S'exécutent sur l'input initial du premier agent du run.

Output Guardrails : S'exécutent sur la sortie finale du dernier agent du run.

from agents import (Agent, Runner, GuardrailFunctionOutput, InputGuardrail,
                    RunContextWrapper, TResponseInputItem, input_guardrail,
                    InputGuardrailTripwireTriggered)
from pydantic import BaseModel
import asyncio

# --- Définition du Guardrail ---
class VerificationContenuSensible(BaseModel):
    contenu_inapproprie: bool
    raison: str

agent_verificateur = Agent(
    name="Vérificateur Contenu",
    instructions="Vérifie si le message de l'utilisateur contient un langage inapproprié.",
    output_type=VerificationContenuSensible,
    model="gpt-4o-mini" # Modèle rapide et peu coûteux
)

# Fonction Guardrail (utilise l'agent vérificateur)
@input_guardrail(name="guardrail_contenu") # Décorateur pour InputGuardrail
async def check_contenu_inapproprie(
    ctx: RunContextWrapper[None], # Type du contexte (None ici)
    agent: Agent,                 # L'agent principal qui serait appelé
    input_data: str | list[TResponseInputItem] # L'input reçu
) -> GuardrailFunctionOutput:
    print("[Guardrail] Vérification du contenu...")
    result = await Runner.run(agent_verificateur, input_data, context=ctx.context)
    verif_output = result.final_output_as(VerificationContenuSensible)

    # Si le contenu est inapproprié, déclencher le tripwire
    trigger = verif_output.contenu_inapproprie
    print(f"[Guardrail] Contenu inapproprié détecté : {trigger}")

    return GuardrailFunctionOutput(
        output_info=verif_output,         # Informations du guardrail (pour logging/trace)
        tripwire_triggered=trigger        # True pour arrêter l'exécution
    )

# --- Agent principal avec Guardrail ---
agent_principal = Agent(
    name="Assistant Poli",
    instructions="Réponds poliment aux questions.",
    input_guardrails=[check_contenu_inapproprie], # Attacher le guardrail
    model="gpt-4o" # Modèle plus coûteux, qu'on ne veut pas exécuter si contenu inapproprié
)

async def main_guardrail():
    print("--- Test Guardrail (OK) ---")
    try:
        result_ok = await Runner.run(agent_principal, "Bonjour, comment allez-vous ?")
        print(f"Réponse OK: {result_ok.final_output}")
    except InputGuardrailTripwireTriggered as e:
        print(f"Erreur inattendue: Le guardrail a été déclenché : {e.guardrail_result.output}")

    print("\n--- Test Guardrail (Déclenché) ---")
    try:
        # Simuler une entrée inappropriée (le vérificateur devrait la détecter)
        await Runner.run(agent_principal, "Message avec des mots offensants...")
        print("Erreur: Le guardrail n'a pas été déclenché !")
    except InputGuardrailTripwireTriggered as e:
        print("Guardrail déclenché comme prévu.")
        print(f"Raison: {e.guardrail_result.output.raison}") # Accéder aux infos du guardrail

if __name__ == "__main__":
   asyncio.run(main_guardrail())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
8. Utilisation de Différents Modèles (y compris Non-OpenAI)
a. Spécifier le Modèle par Agent

Vous pouvez définir un modèle différent pour chaque agent.

agent_rapide = Agent(name="Tri", model="gpt-4o-mini", ...)
agent_puissant = Agent(name="Analyse", model="gpt-4o", ...)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
b. Utiliser LiteLLM pour d'autres Fournisseurs

Installez la dépendance : pip install "openai-agents[litellm]"

Utilisez le préfixe litellm/ suivi du chemin du modèle. Vous devrez configurer les clés API pour les fournisseurs respectifs (généralement via des variables d'environnement spécifiques à LiteLLM ou directement).

from agents.extensions.models.litellm_model import LitellmModel

# Exemple avec Anthropic Claude 3.5 Sonnet ( nécessite une clé API Anthropic)
# export ANTHROPIC_API_KEY=votre_clé
agent_claude = Agent(
    name="Agent Claude",
    instructions="Parle comme Claude d'Anthropic.",
    model=LitellmModel(model="anthropic/claude-3-5-sonnet-20240620")
    # Alternative pour passer la clé directement (moins sécurisé):
    # model=LitellmModel(model="anthropic/claude-3-5-sonnet-20240620", api_key="votre_clé_anthropic")
)

# Exemple avec Google Gemini (nécessite une clé API Google)
# export GEMINI_API_KEY=votre_clé
agent_gemini = Agent(
    name="Agent Gemini",
    instructions="Parle comme Gemini de Google.",
    model=LitellmModel(model="gemini/gemini-1.5-flash-latest")
)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

Important: Lorsque vous utilisez des modèles non-OpenAI :

Traçage : Le traçage par défaut envoie les données aux serveurs OpenAI. Si vous n'avez pas de clé API OpenAI, désactivez le traçage (set_tracing_disabled(True)) ou utilisez un processeur de trace externe (voir section Traçage).

API Responses vs Chat Completions : Le SDK utilise l'API Responses par défaut. La plupart des autres fournisseurs utilisent l'API Chat Completions. Si vous rencontrez des erreurs 404, essayez de forcer l'utilisation de Chat Completions globalement (set_default_openai_api("chat_completions")) ou utilisez OpenAIChatCompletionsModel explicitement.

Fonctionnalités : Les fonctionnalités comme les sorties structurées, les outils hébergés (recherche web/fichier) peuvent ne pas être supportées par tous les modèles/fournisseurs.

9. Streaming des Réponses

Recevez les réponses de l'agent au fur et à mesure qu'elles sont générées.

from agents import Agent, Runner
from openai.types.responses import ResponseTextDeltaEvent # Pour typer les événements bruts
import asyncio

agent_stream = Agent(
    name="Pipelette",
    instructions="Raconte une histoire courte sur un chat astronaute."
)

async def main_streaming():
    print("--- Début du Streaming ---")
    result_stream = Runner.run_streamed(agent_stream, "Vas-y, raconte !")

    texte_complet = ""
    # Itérer sur les événements du stream
    async for event in result_stream.stream_events():
        # Option 1: Gérer les événements bruts (token par token)
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                print(event.data.delta, end="", flush=True) # Affiche le texte au fur et à mesure
                texte_complet += event.data.delta
        # Option 2: Gérer les événements sémantiques (quand un item est complet)
        elif event.type == "run_item_stream_event":
            if event.item.type == "message_output_item":
                # L'intégralité d'un message est disponible (peut être utile après coup)
                pass # print(f"\n[Message complet reçu]")
            elif event.item.type == "tool_call_item":
                print(f"\n[Appel d'outil demandé : {event.item.raw_item.name}]")
            elif event.item.type == "tool_call_output_item":
                 print(f"\n[Résultat d'outil reçu : {event.item.output}]")
        elif event.type == "agent_updated_stream_event":
             print(f"\n[Agent mis à jour vers : {event.new_agent.name}]")

    print("\n--- Fin du Streaming ---")
    # result_stream contient maintenant les informations complètes de l'exécution
    print(f"\nAgent final: {result_stream.last_agent.name}")
    # print(f"Texte complet reconstruit: {texte_complet}") # Identique à result_stream.final_output

if __name__ == "__main__":
    asyncio.run(main_streaming())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
10. Traçage (Tracing)

Le traçage est activé par défaut et essentiel pour le débogage et la surveillance.

Visualisation : Accédez au Trace viewer dans le tableau de bord OpenAI pour voir les exécutions.

Désactivation :

Variable d'environnement : export OPENAI_AGENTS_DISABLE_TRACING=1

Par exécution : Runner.run(..., run_config=RunConfig(tracing_disabled=True))

Traces imbriquées : Utilisez with trace("Nom du Workflow"): pour regrouper plusieurs appels Runner.run() dans une seule trace logique.

Données Sensibles : Empêchez l'enregistrement des inputs/outputs des LLM/outils dans les traces : RunConfig(trace_include_sensitive_data=False). Pour l'audio dans les traces vocales : VoicePipelineConfig(trace_include_sensitive_audio_data=False).

Processeurs Externes : Intégrez d'autres plateformes de traçage (W&B, LangSmith, MLflow, etc.) via add_trace_processor() ou set_trace_processors(). Voir la liste dans la documentation "External tracing processors list".

11. Configuration Avancée du SDK

Utilisez les fonctions au niveau du module agents pour une configuration globale :

from agents import (
    set_default_openai_key,
    set_default_openai_client,
    set_default_openai_api,
    set_tracing_export_api_key,
    set_tracing_disabled,
    enable_verbose_stdout_logging
)
from openai import AsyncOpenAI

# Définir la clé API par défaut (alternative à la variable d'env)
# set_default_openai_key("sk-...", use_for_tracing=True)

# Utiliser un client OpenAI personnalisé (ex: pour Azure, autre endpoint)
# custom_client = AsyncOpenAI(base_url="...", api_key="...")
# set_default_openai_client(custom_client, use_for_tracing=True)

# Forcer l'utilisation de l'API Chat Completions au lieu de Responses
# set_default_openai_api("chat_completions")

# Définir une clé API spécifique pour l'export du traçage
# set_tracing_export_api_key("sk-...")

# Désactiver globalement le traçage
# set_tracing_disabled(True)

# Activer les logs détaillés du SDK sur stdout (pour le débogage)
# enable_verbose_stdout_logging()

# Configuration manuelle du logging Python
# import logging
# logger = logging.getLogger("openai.agents") # ou openai.agents.tracing
# logger.setLevel(logging.DEBUG)
# logger.addHandler(logging.StreamHandler())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

Désactiver le logging de données sensibles (via variables d'environnement) :

export OPENAI_AGENTS_DONT_LOG_MODEL_DATA=1  # Désactive log input/output LLM
export OPENAI_AGENTS_DONT_LOG_TOOL_DATA=1   # Désactive log input/output outils
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
12. Fonctionnalités Vocales (Voice)

Le SDK inclut des fonctionnalités pour créer des agents vocaux.

a. Concepts Clés

VoicePipeline: Orchestre le flux STT -> Workflow -> TTS.

VoiceWorkflowBase: Classe de base pour définir la logique métier (souvent un Runner.run_streamed). SingleAgentVoiceWorkflow est une implémentation simple.

AudioInput: Entrée audio statique (fichier complet).

StreamedAudioInput: Entrée audio en streaming (depuis un micro).

StreamedAudioResult: Résultat du pipeline, permet de streamer les événements audio de sortie.

b. Exemple Simple (Audio Statique)

(Nécessite pip install "openai-agents[voice]" numpy sounddevice)

# Reprend les agents de l'exemple Handoff (agent_maths, agent_histoire, agent_triage)
# ... (définitions des agents et outils comme dans la section 5) ...

from agents.voice import (
    AudioInput,
    SingleAgentVoiceWorkflow,
    VoicePipeline,
    VoicePipelineConfig
)
import numpy as np
import sounddevice as sd # Pour jouer l'audio

async def main_voice_static():
    # Configurer le pipeline avec l'agent triage comme workflow
    pipeline = VoicePipeline(
        workflow=SingleAgentVoiceWorkflow(agent_triage), # Utilise l'agent défini avant
        # stt_model="whisper-1", # Modèle STT par défaut
        # tts_model="tts-1",     # Modèle TTS par défaut
        # config=VoicePipelineConfig(...) # Configuration optionnelle
    )

    # Simuler une entrée audio (3 secondes de silence ici)
    # Dans un cas réel, chargez un fichier ou capturez du micro
    print("Préparation de l'audio d'entrée (silence)...")
    samplerate = 24000 # Taux d'échantillonnage commun pour les modèles TTS/STT OpenAI
    duration = 3
    silence_buffer = np.zeros(samplerate * duration, dtype=np.int16)
    audio_input = AudioInput(buffer=silence_buffer, frame_rate=samplerate)

    print("Lancement du pipeline vocal (cela peut prendre un moment)...")
    # NOTE: Le pipeline va transcrire le silence (texte vide),
    # l'agent ne saura probablement pas quoi faire.
    # Pour un test réel, utilisez un fichier audio avec une question.
    result = await pipeline.run(audio_input)

    print("Pipeline terminé. Lecture de la réponse audio...")
    # Configuration du lecteur audio
    player = sd.OutputStream(samplerate=samplerate, channels=1, dtype=np.int16)
    player.start()

    # Lire le flux audio de sortie
    try:
        async for event in result.stream():
            if event.type == "voice_stream_event_audio":
                if event.data is not None:
                    player.write(event.data)
            elif event.type == "voice_stream_event_lifecycle":
                print(f"[Lifecycle Event: {event.event}]")
            elif event.type == "voice_stream_event_error":
                print(f"[Erreur Stream: {event.error}]")
                break
        print("Lecture audio terminée.")
    finally:
        player.stop()
        player.close()

if __name__ == "__main__":
    # Pour un test plus significatif, remplacez la génération de silence
    # par le chargement d'un fichier .wav ou l'enregistrement micro.
    # Exemple:
    # import soundfile as sf
    # data, samplerate = sf.read('votre_question.wav', dtype='int16')
    # audio_input = AudioInput(buffer=data, frame_rate=samplerate)
    asyncio.run(main_voice_static())
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

(Voir la documentation "Voice App Pipelines" et les exemples dans le repo pour des scénarios plus complexes avec StreamedAudioInput et la gestion des tours de parole)

13. Visualisation des Agents

(Nécessite pip install "openai-agents[viz]" et l'installation de Graphviz: https://graphviz.org/download/)

Visualisez la structure de vos agents, outils et handoffs.

from agents.extensions.visualization import draw_graph

# Reprend les agents de l'exemple Handoff (agent_maths, agent_histoire, agent_triage)
# ... (définitions des agents et outils comme dans la section 5) ...
# Ajoutons un outil à l'agent triage pour la démo
@function_tool
def get_heure() -> str:
    """Retourne l'heure actuelle."""
    import datetime
    return datetime.datetime.now().isoformat()

agent_triage.tools.append(get_heure) # Ajoute l'outil à l'agent existant

# Générer et afficher le graphe (ouvre une fenêtre ou s'affiche inline dans Jupyter)
print("Génération du graphe de l'agent triage...")
graph = draw_graph(agent_triage)
# Pour sauvegarder en fichier : graph.render('agent_triage_graph', format='png', view=False)
# Pour afficher dans une fenêtre séparée (si supporté) : graph.view()
print("Graphe généré (vérifiez la sortie ou le fichier sauvegardé).")
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

Le graphe montre les agents (boîtes jaunes), les outils (ellipses vertes) et les handoffs (flèches pleines entre agents).

Ceci conclut le tutoriel complet basé sur la documentation fournie. N'hésitez pas à explorer les exemples dans le dépôt GitHub (examples/) et la documentation de référence (ref/) pour approfondir chaque concept !

some example:

import asyncio

from agents import Agent, ItemHelpers, MessageOutputItem, Runner, trace

"""
This example shows the agents-as-tools pattern. The frontline agent receives a user message and
then picks which agents to call, as tools. In this case, it picks from a set of translation
agents.
"""

spanish_agent = Agent(
    name="spanish_agent",
    instructions="You translate the user's message to Spanish",
    handoff_description="An english to spanish translator",
)

french_agent = Agent(
    name="french_agent",
    instructions="You translate the user's message to French",
    handoff_description="An english to french translator",
)

italian_agent = Agent(
    name="italian_agent",
    instructions="You translate the user's message to Italian",
    handoff_description="An english to italian translator",
)

orchestrator_agent = Agent(
    name="orchestrator_agent",
    instructions=(
        "You are a translation agent. You use the tools given to you to translate."
        "If asked for multiple translations, you call the relevant tools in order."
        "You never translate on your own, you always use the provided tools."
    ),
    tools=[
        spanish_agent.as_tool(
            tool_name="translate_to_spanish",
            tool_description="Translate the user's message to Spanish",
        ),
        french_agent.as_tool(
            tool_name="translate_to_french",
            tool_description="Translate the user's message to French",
        ),
        italian_agent.as_tool(
            tool_name="translate_to_italian",
            tool_description="Translate the user's message to Italian",
        ),
    ],
)

synthesizer_agent = Agent(
    name="synthesizer_agent",
    instructions="You inspect translations, correct them if needed, and produce a final concatenated response.",
)


async def main():
    msg = input("Hi! What would you like translated, and to which languages? ")

    # Run the entire orchestration in a single trace
    with trace("Orchestrator evaluator"):
        orchestrator_result = await Runner.run(orchestrator_agent, msg)

        for item in orchestrator_result.new_items:
            if isinstance(item, MessageOutputItem):
                text = ItemHelpers.text_message_output(item)
                if text:
                    print(f"  - Translation step: {text}")

        synthesizer_result = await Runner.run(
            synthesizer_agent, orchestrator_result.to_input_list()
        )

    print(f"\n\nFinal response:\n{synthesizer_result.final_output}")


if __name__ == "__main__":
    asyncio.run(main())

----

from __future__ import annotations

import asyncio
from typing import Any, Literal

from pydantic import BaseModel

from agents import (
    Agent,
    FunctionToolResult,
    ModelSettings,
    RunContextWrapper,
    Runner,
    ToolsToFinalOutputFunction,
    ToolsToFinalOutputResult,
    function_tool,
)

"""
This example shows how to force the agent to use a tool. It uses ModelSettings(tool_choice="required")
to force the agent to use any tool.

You can run it with 3 options:
1. default: The default behavior, which is to send the tool output to the LLM. In this case,
    tool_choice is not set, because otherwise it would result in an infinite loop - the LLM would
    call the tool, the tool would run and send the results to the LLM, and that would repeat
    (because the model is forced to use a tool every time.)
2. first_tool_result: The first tool result is used as the final output.
3. custom: A custom tool use behavior function is used. The custom function receives all the tool
    results, and chooses to use the first tool result to generate the final output.

Usage:
python examples/agent_patterns/forcing_tool_use.py -t default
python examples/agent_patterns/forcing_tool_use.py -t first_tool
python examples/agent_patterns/forcing_tool_use.py -t custom
"""


class Weather(BaseModel):
    city: str
    temperature_range: str
    conditions: str


@function_tool
def get_weather(city: str) -> Weather:
    print("[debug] get_weather called")
    return Weather(city=city, temperature_range="14-20C", conditions="Sunny with wind")


async def custom_tool_use_behavior(
    context: RunContextWrapper[Any], results: list[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    weather: Weather = results[0].output
    return ToolsToFinalOutputResult(
        is_final_output=True, final_output=f"{weather.city} is {weather.conditions}."
    )


async def main(tool_use_behavior: Literal["default", "first_tool", "custom"] = "default"):
    if tool_use_behavior == "default":
        behavior: Literal["run_llm_again", "stop_on_first_tool"] | ToolsToFinalOutputFunction = (
            "run_llm_again"
        )
    elif tool_use_behavior == "first_tool":
        behavior = "stop_on_first_tool"
    elif tool_use_behavior == "custom":
        behavior = custom_tool_use_behavior

    agent = Agent(
        name="Weather agent",
        instructions="You are a helpful agent.",
        tools=[get_weather],
        tool_use_behavior=behavior,
        model_settings=ModelSettings(
            tool_choice="required" if tool_use_behavior != "default" else None
        ),
    )

    result = await Runner.run(agent, input="What's the weather in Tokyo?")
    print(result.final_output)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-t",
        "--tool-use-behavior",
        type=str,
        required=True,
        choices=["default", "first_tool", "custom"],
        help="The behavior to use for tool use. Default will cause tool outputs to be sent to the model. "
        "first_tool_result will cause the first tool result to be used as the final output. "
        "custom will use a custom tool use behavior function.",
    )
    args = parser.parse_args()
    asyncio.run(main(args.tool_use_behavior))

---

import asyncio

from agents import Agent, ItemHelpers, Runner, trace

"""
This example shows the parallelization pattern. We run the agent three times in parallel, and pick
the best result.
"""

spanish_agent = Agent(
    name="spanish_agent",
    instructions="You translate the user's message to Spanish",
)

translation_picker = Agent(
    name="translation_picker",
    instructions="You pick the best Spanish translation from the given options.",
)


async def main():
    msg = input("Hi! Enter a message, and we'll translate it to Spanish.\n\n")

    # Ensure the entire workflow is a single trace
    with trace("Parallel translation"):
        res_1, res_2, res_3 = await asyncio.gather(
            Runner.run(
                spanish_agent,
                msg,
            ),
            Runner.run(
                spanish_agent,
                msg,
            ),
            Runner.run(
                spanish_agent,
                msg,
            ),
        )

        outputs = [
            ItemHelpers.text_message_outputs(res_1.new_items),
            ItemHelpers.text_message_outputs(res_2.new_items),
            ItemHelpers.text_message_outputs(res_3.new_items),
        ]

        translations = "\n\n".join(outputs)
        print(f"\n\nTranslations:\n\n{translations}")

        best_translation = await Runner.run(
            translation_picker,
            f"Input: {msg}\n\nTranslations:\n{translations}",
        )

    print("\n\n-----")

    print(f"Best translation: {best_translation.final_output}")


if __name__ == "__main__":
    asyncio.run(main())