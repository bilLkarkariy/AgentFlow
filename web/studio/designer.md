# Flow Designer Node Reference

Ce document décrit chaque type de nœud disponible dans l’éditeur visuel et explique leur rôle, leurs handles, et leurs propriétés.

---

## 1. Start
- **Type** : `start`
- **Usage** : Point d’entrée du flow. Chaque flow doit avoir exactement un nœud `Start`.
- **Handles** : 
  - `source` (Position.Bottom)
- **Propriétés** : Aucun champ à configurer.
- **Fonctionnement** : Déclenche la première exécution. Branchez le handle `source` vers la suite du flow.

## 2. Email Send
- **Type** : `emailSend`
- **Usage** : Envoi d’un email.
- **Handles** :
  - `target` (Position.Top)
  - `source` (Position.Bottom)
- **Propriétés** :
  - `label` : nom affiché (par défaut `Email Send`)
  - `to` : destinataire (adresse email)
  - `subject` : objet du mail
- **Fonctionnement** : Attend une exécution entrante, envoie l’email, puis propage l’exécution vers le handle `source`.

## 3. Slack Post
- **Type** : `slackPost`
- **Usage** : Publication d’un message sur Slack.
- **Handles** :
  - `target` (Position.Top)
  - `source` (Position.Bottom)
- **Propriétés** :
  - `label` : nom affiché (par défaut `Slack Post`)
  - `channel` : nom ou ID du canal
  - `message` : contenu du message
- **Fonctionnement** : Publie sur Slack puis continue le flow.

## 4. Condition
- **Type** : `condition`
- **Usage** : Bifurcation conditionnelle.
- **Handles** :
  - `target` (Position.Top)
  - `source(id="true")` (Position.Bottom, 25%)
  - `source(id="false")` (Position.Bottom, 75%)
- **Propriétés** :
  - `label` : nom affiché (par défaut `Condition`)
  - `expression` : expression JS (p.ex. `amount > 1000`)
- **Fonctionnement** : Évalue l’expression et envoie l’exécution sur la sortie `true` ou `false`.

## 5. Loop
- **Type** : `loop`
- **Usage** : Itération sur une collection.
- **Handles** :
  - `target` (Position.Top)
  - `source(id="body")` (Position.Bottom, 25%) — corps de boucle
  - `source(id="next")` (Position.Bottom, 75%) — suite après boucle
- **Propriétés** :
  - `label` : nom affiché (par défaut `Loop`)
  - `collection` : nom de la variable contenant la liste
- **Fonctionnement** : Pour chaque élément de la collection, le flux passe par `body`. Une fois tous traités, le flux reprend via `next`.

## 6. Agent Block
- **Type** : `agent`
- **Usage** : Simulation IA via Agent Runtime (`POST /run`).
- **Handles** :
  - `target` (Position.Top)
  - `source` (Position.Bottom)
- **Propriétés** :
  - `prompt` (texte du prompt)
  - `model` (ex. `o4-mini`)
  - `temperature` (0 à 1)
- **Fonctionnement** : Drag & drop, saisie du prompt, cliquer **Simulate** pour obtenir et afficher le résultat JSON dans le node.

---

> **Note** : La validation des cycles empêche les boucles infinies. Le handle `Start` doit être unique.
