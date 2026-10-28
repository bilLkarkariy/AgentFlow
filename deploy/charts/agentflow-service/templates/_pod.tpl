{{/*
Pod template shared by the Deployment and the Rollout. Called with the root
context and included under `template:` (nindent 4).
*/}}
{{- define "agentflow-service.podTemplate" -}}
metadata:
  annotations:
    checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    {{- with .Values.podAnnotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  labels:
    {{- include "agentflow-service.podLabels" . | nindent 4 }}
spec:
  {{- with .Values.imagePullSecrets }}
  imagePullSecrets:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  serviceAccountName: {{ include "agentflow-service.serviceAccountName" . }}
  automountServiceAccountToken: {{ .Values.serviceAccount.automountServiceAccountToken }}
  terminationGracePeriodSeconds: {{ .Values.terminationGracePeriodSeconds }}
  {{- with .Values.podSecurityContext }}
  securityContext:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  containers:
    - name: {{ include "agentflow-service.appLabel" . }}
      image: {{ include "agentflow-service.image" . }}
      imagePullPolicy: {{ .Values.image.pullPolicy }}
      {{- with .Values.command }}
      command:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.args }}
      args:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      ports:
        - name: http
          containerPort: {{ .Values.containerPort }}
          protocol: TCP
      envFrom:
        {{- include "agentflow-service.envFrom" . | trim | nindent 8 }}
      {{- with (include "agentflow-service.env" . | trim) }}
      env:
        {{- . | nindent 8 }}
      {{- end }}
      {{- if .Values.probes.startup.enabled }}
      startupProbe:
        {{- include "agentflow-service.probe" .Values.probes.startup | trim | nindent 8 }}
      {{- end }}
      {{- if .Values.probes.liveness.enabled }}
      livenessProbe:
        {{- include "agentflow-service.probe" .Values.probes.liveness | trim | nindent 8 }}
      {{- end }}
      {{- if .Values.probes.readiness.enabled }}
      readinessProbe:
        {{- include "agentflow-service.probe" .Values.probes.readiness | trim | nindent 8 }}
      {{- end }}
      {{- with .Values.resources }}
      resources:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.containerSecurityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.volumeMounts }}
      volumeMounts:
        {{- toYaml . | nindent 8 }}
      {{- end }}
  {{- with .Values.volumes }}
  volumes:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.nodeSelector }}
  nodeSelector:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.tolerations }}
  tolerations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.affinity }}
  affinity:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.topologySpreadConstraints }}
  topologySpreadConstraints:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end -}}
