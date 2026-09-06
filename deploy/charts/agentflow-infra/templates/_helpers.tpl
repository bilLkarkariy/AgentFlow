{{/*
Chart name, truncated to the 63 character label limit.
*/}}
{{- define "agentflow-infra.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Release-wide fullname. Object names are pinned per component (agentflow-db,
agentflow-redis, agentflow-rabbitmq) because the workloads reference them by
name in their env; this helper only backs the shared labels.
*/}}
{{- define "agentflow-infra.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Chart label, e.g. agentflow-infra-0.1.0.
*/}}
{{- define "agentflow-infra.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Labels shared by every object.
Usage: include "agentflow-infra.labels" (dict "root" . "component" "redis")
*/}}
{{- define "agentflow-infra.labels" -}}
{{- $root := .root -}}
helm.sh/chart: {{ include "agentflow-infra.chart" $root }}
{{ include "agentflow-infra.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ $root.Release.Service }}
app.kubernetes.io/part-of: agentflow
{{- with $root.Chart.AppVersion }}
app.kubernetes.io/version: {{ . | quote }}
{{- end }}
{{- with $root.Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/*
Immutable selector labels of a component.
Usage: include "agentflow-infra.selectorLabels" (dict "root" . "component" "redis")
*/}}
{{- define "agentflow-infra.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agentflow-infra.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Common annotations block, rendered only when there is something to render.
*/}}
{{- define "agentflow-infra.annotations" -}}
{{- with .Values.commonAnnotations }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/*
Name of the Secret holding the RabbitMQ credentials: either the one this
chart creates, or the one supplied by External Secrets.
*/}}
{{- define "agentflow-infra.rabbitmq.secretName" -}}
{{- default .Values.rabbitmq.name .Values.rabbitmq.auth.existingSecret -}}
{{- end -}}

{{/*
AMQP URL derived from the rabbitmq values.

The trailing "//" is deliberate: the path component of an AMQP URI is the
virtual host, so `amqp://user:pass@host:5672//` means "vhost /".
*/}}
{{- define "agentflow-infra.rabbitmq.url" -}}
{{- $r := .Values.rabbitmq -}}
{{- $vhost := $r.auth.vhost | default "/" -}}
{{- printf "amqp://%s:%s@%s:%v/%s" $r.auth.username $r.auth.password $r.name $r.ports.amqp $vhost -}}
{{- end -}}

{{/*
Broker URL used by appSecrets: the explicit override wins, otherwise it is
derived from the rabbitmq values. Fails loudly rather than shipping an empty
connection string.
*/}}
{{- define "agentflow-infra.brokerUrl" -}}
{{- if .Values.appSecrets.brokerUrl -}}
{{- .Values.appSecrets.brokerUrl -}}
{{- else if and .Values.rabbitmq.enabled (not .Values.rabbitmq.auth.existingSecret) -}}
{{- include "agentflow-infra.rabbitmq.url" . -}}
{{- else -}}
{{- fail "appSecrets.create needs appSecrets.brokerUrl when rabbitmq is disabled or uses auth.existingSecret" -}}
{{- end -}}
{{- end -}}
