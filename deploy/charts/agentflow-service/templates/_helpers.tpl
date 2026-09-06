{{/*
Base name of the release. The release is already named after the service
(agentflow-api, agentflow-worker, ...), so the release name is the default.
*/}}
{{- define "agentflow-service.name" -}}
{{- default .Release.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified name used for every rendered object (Rollout/Deployment,
Service, VirtualService, DestinationRule, ConfigMap, ...). Keeping it equal to
the name keeps the Service short and stable: agentflow-api:80.
*/}}
{{- define "agentflow-service.fullname" -}}
{{- include "agentflow-service.name" . -}}
{{- end -}}

{{/*
Chart name and version, as used by the helm.sh/chart label.
*/}}
{{- define "agentflow-service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Short workload label (`app`) shared with Istio and the DestinationRule subsets.
*/}}
{{- define "agentflow-service.appLabel" -}}
{{- default (include "agentflow-service.name" .) .Values.appLabel -}}
{{- end -}}

{{/*
Value of the `version` label: Istio canonical revision and canary analysis key.
*/}}
{{- define "agentflow-service.version" -}}
{{- default (default .Chart.AppVersion .Values.image.tag) .Values.version -}}
{{- end -}}

{{/*
Selector labels. Immutable: never add anything here.
*/}}
{{- define "agentflow-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agentflow-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Common labels put on every object.
*/}}
{{- define "agentflow-service.labels" -}}
helm.sh/chart: {{ include "agentflow-service.chart" . }}
{{ include "agentflow-service.selectorLabels" . }}
app.kubernetes.io/version: {{ include "agentflow-service.version" . | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: agentflow
{{- end -}}

{{/*
Pod labels: selector labels plus the Istio pair (`app`, `version`) that the
DestinationRule subsets and the canary analysis rely on.
*/}}
{{- define "agentflow-service.podLabels" -}}
{{ include "agentflow-service.selectorLabels" . }}
app: {{ include "agentflow-service.appLabel" . }}
version: {{ include "agentflow-service.version" . | quote }}
{{- with .Values.podLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/*
Fully qualified image reference.
*/}}
{{- define "agentflow-service.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) -}}
{{- end -}}

{{/*
ServiceAccount name.
*/}}
{{- define "agentflow-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "agentflow-service.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Name of the Secret consumed with envFrom, if any.
*/}}
{{- define "agentflow-service.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else if .Values.secrets.create -}}
{{- include "agentflow-service.fullname" . -}}
{{- end -}}
{{- end -}}

{{/*
True when the Rollout drives Istio subset traffic shifting.
*/}}
{{- define "agentflow-service.istioTrafficRouting" -}}
{{- if and .Values.rollout.enabled .Values.rollout.canary.trafficRouting.istio.enabled -}}
true
{{- end -}}
{{- end -}}

{{/*
Ordered list of the VirtualService route names, also referenced by the Rollout.
*/}}
{{- define "agentflow-service.routeNames" -}}
{{- $routes := list "primary" -}}
{{- if .Values.istio.virtualService.streamingPaths -}}
{{- $routes = append $routes "streaming" -}}
{{- end -}}
{{- toJson $routes -}}
{{- end -}}

{{/*
Render one probe. Input: the probe values map. httpGet and exec are exclusive.
*/}}
{{- define "agentflow-service.probe" -}}
{{- if and .httpGet .exec -}}
{{- fail "probes: httpGet and exec are mutually exclusive" -}}
{{- end -}}
{{- if .httpGet }}
httpGet:
  {{- toYaml .httpGet | nindent 2 }}
{{- else if .exec }}
exec:
  {{- toYaml .exec | nindent 2 }}
{{- else -}}
{{- fail "probes: an enabled probe needs either httpGet or exec" -}}
{{- end }}
{{- range $key, $value := omit . "enabled" "httpGet" "exec" }}
{{ $key }}: {{ $value }}
{{- end }}
{{- end -}}

{{/*
Environment shared by the app container and the migration Job.
*/}}
{{- define "agentflow-service.envFrom" -}}
- configMapRef:
    name: {{ include "agentflow-service.fullname" . }}
{{- with (include "agentflow-service.secretName" .) }}
- secretRef:
    name: {{ . }}
{{- end }}
{{- with .Values.extraEnvFrom }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "agentflow-service.env" -}}
{{- if and .Values.database.existingSecret .Values.database.secretKey }}
- name: POSTGRES_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.existingSecret }}
      key: {{ .Values.database.secretKey }}
{{- end }}
{{- if .Values.runtimeConfig.enabled }}
{{- range $key, $value := .Values.runtimeConfig.values }}
- name: APP_{{ $key }}
  value: {{ $value | quote }}
{{- end }}
{{- end }}
{{- with .Values.extraEnv }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/*
Sanity checks shared by every template that renders a workload.
*/}}
{{- define "agentflow-service.validate" -}}
{{- if and (include "agentflow-service.istioTrafficRouting" .) (not .Values.istio.virtualService.enabled) -}}
{{- fail "rollout.canary.trafficRouting.istio.enabled requires istio.virtualService.enabled" -}}
{{- end -}}
{{- if and .Values.serviceMonitor.enabled (not .Values.service.enabled) -}}
{{- fail "serviceMonitor.enabled requires service.enabled" -}}
{{- end -}}
{{- if and .Values.rollout.enabled .Values.rollout.canary.analysis.enabled (not .Values.rollout.canary.analysis.templates) -}}
{{- fail "rollout.canary.analysis.enabled requires at least one entry in rollout.canary.analysis.templates" -}}
{{- end -}}
{{- if and .Values.secrets.create .Values.secrets.existingSecret -}}
{{- fail "secrets.create and secrets.existingSecret are mutually exclusive" -}}
{{- end -}}
{{- end -}}

{{/*
Route destinations of the VirtualService. With Istio traffic routing the Rollout
rewrites the weights, so the chart only renders the starting point
(stable 100 / canary 0).
*/}}
{{- define "agentflow-service.vsDestinations" -}}
{{- $host := include "agentflow-service.fullname" . -}}
{{- $port := .Values.service.port -}}
{{- if include "agentflow-service.istioTrafficRouting" . }}
- destination:
    host: {{ $host }}
    subset: stable
    port:
      number: {{ $port }}
  weight: 100
- destination:
    host: {{ $host }}
    subset: canary
    port:
      number: {{ $port }}
  weight: 0
{{- else }}
- destination:
    host: {{ $host }}
    port:
      number: {{ $port }}
{{- end }}
{{- end -}}
