{{/*
Namespace ArgoCD itself lives in. Every Application object is created there.
*/}}
{{- define "bootstrap.argocdNamespace" -}}
{{- .Values.global.argocdNamespace | default "argocd" -}}
{{- end -}}

{{/*
Active environment (local | aws). Injected by the platform-root Application
as `global.env`.
*/}}
{{- define "bootstrap.env" -}}
{{- required "global.env is required (local|aws)" .Values.global.env -}}
{{- end -}}

{{/*
Git repository holding this chart, the platform values and deploy/argocd/envs.
*/}}
{{- define "bootstrap.repoURL" -}}
{{- required "global.repoURL is required" .Values.global.repoURL -}}
{{- end -}}

{{/*
Git revision every git source is pinned to.
*/}}
{{- define "bootstrap.gitRevision" -}}
{{- .Values.global.gitRevision | default "main" -}}
{{- end -}}

{{/*
Decide whether a component is rendered.
Usage: include "bootstrap.enabled" (dict "component" $c "root" $)
Returns "true" or "".
*/}}
{{- define "bootstrap.enabled" -}}
{{- $c := .component -}}
{{- $profile := .root.Values.global.profile | default "full" -}}
{{- $profiles := $c.profiles | default (list "minimal" "full") -}}
{{- if and (ne $c.enabled false) (has $profile $profiles) -}}
true
{{- end -}}
{{- end -}}

{{/*
Sync options shared by every Application (plan section 5) plus the per
component extras.
Usage: include "bootstrap.syncOptions" (dict "component" $c "root" $)
*/}}
{{- define "bootstrap.syncOptions" -}}
{{- $base := list "CreateNamespace=true" "ServerSideApply=true" "ApplyOutOfSyncOnly=true" "RespectIgnoreDifferences=true" -}}
{{- range concat $base (.component.extraSyncOptions | default list) }}
- {{ . | quote }}
{{- end }}
{{- end -}}
