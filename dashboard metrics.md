# Idées de métriques pour le Dashboard

## ROI & Usage

- **Temps économisé total**  
  Somme des `timeSavedMinutes` pour la période sélectionnée.
- **Nombre d’exécutions**  
  Nombre total de `TaskRun` sur la période.
- **Temps moyen économisé par exécution**  
  `Temps économisé total / Nombre d’exécutions`.
- **Nouveaux utilisateurs actifs**  
  Nombre d’utilisateurs ayant déclenché au moins une exécution.
- **Taux d’adoption jour/semaine/mois**  
  % d’utilisateurs actifs quotidiens/hebdomadaires/mensuels.

## Fiabilité & Qualité

- **Taux de succès**  
  % d’exécutions abouties vs échouées.
- **Taux d’erreur par type d’agent**  
  Répartition des failures selon le trigger/action.
- **Temps de latence moyen**  
  Délai moyen entre l’événement trigger et la fin de l’action.
- **Alertes Slack envoyées**  
  Nb de notifications d’erreur générées.

## Performance & Scalabilité

- **Durée moyenne de traitement Cron**  
  Temps d’exécution du job d’agrégation.
- **Taille de la queue**  
  Nombre de jobs BullMQ en attente/exécution.
- **Charge Redis**  
  Ops/sec, mémoire utilisée.

## Business & Financière

- **MRR (Revenu Mensuel Récurrent)**  
  Calculé depuis Stripe selon subscriptions actives.
- **Churn rate**  
  % de résiliations sur le mois.
- **ARPU (Revenu Moyen par Utilisateur)**  
  MRR / nombre d’utilisateurs actifs.

## Adoption & Engagement

- **Nombre d’agents créés**  
  Total et par type de trigger.
- **Actions les plus utilisées**  
  Classement des `dsl.action.type`.
- **Source des triggers**  
  % répartitions (Gmail, Webhook, etc.).

## Personnalisation & Feedback

- **Score de satisfaction**  
  (NPS) récolté via enquêtes après exécution.
- **Feedback utilisateur**  
  Résumé des retours/bug reports.
