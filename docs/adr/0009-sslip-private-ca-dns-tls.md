# 0009 — `sslip.io` for DNS and a private CA for TLS

## Status

Accepted, 2026-09-06.

## Context

Nine hostnames need to resolve locally (`api`, `studio`, `dashboard`, `argocd`,
`grafana`, `kiali`, `rollouts`, `prometheus`, `alertmanager`) and three on AWS
(`api`, `studio`, `dashboard`). All of them are served by one Istio `Gateway`
with a wildcard certificate.

The constraints are unusual in both directions:

- **Local**: no domain, no DNS server, and ideally no `sudo`. The cluster must
  be reachable by name from a browser and from `curl` within seconds of
  creation.
- **AWS**: the environment is created and destroyed several times a week, and
  its public address is **two Elastic IPs that do not exist until Terraform has
  run**. A hosted zone costs 0.50 USD/month — more than a whole demo session —
  and any DNS-based certificate flow would have to wait for propagation on every
  creation.

## Decision

**DNS: `sslip.io`.** It is a public wildcard DNS service that resolves
`anything.1-2-3-4.sslip.io` (and `anything.1.2.3.4.sslip.io`) to `1.2.3.4`.

| Environment | Domain | Resolves to |
|---|---|---|
| local | `127.0.0.1.sslip.io` | `127.0.0.1`, where kind maps host ports 80/443 to NodePorts 30080/30443 |
| aws | `<first-eip-with-dashes>.sslip.io` | the ingress Elastic IP |

**TLS: a private CA.** cert-manager holds `ClusterIssuer agentflow-ca` and
issues one wildcard `Certificate` into the `istio-ingress` namespace as
`agentflow-wildcard-tls`, which the `Gateway` serves.

- local: the CA is generated in-cluster by cert-manager.
- aws: the CA comes from Secrets Manager `agentflow/demo/ca`, pushed there by
  `make aws-bootstrap` from `~/.agentflow/ca`, projected by External Secrets.
  `make aws-trust-ca` adds it to the macOS login keychain.

`scripts/hosts-setup.sh` still exists and still writes a single `# agentflow`
tagged line into `/etc/hosts`, but `make local-up` skips it when `DOMAIN` ends in
`sslip.io` or `nip.io`. It is the fallback for a machine with no DNS egress, and
for anyone who wants a domain that looks like a real one.

## Consequences

**Positive**

- **Zero setup, zero cost, zero `sudo`.** `make local-up` on a fresh machine
  gives working hostnames with no manual step and nothing left behind on the
  host afterwards.
- The AWS domain is a **pure function of the EIP**, so it is known the moment
  Terraform finishes, needs no propagation wait, and needs no registrar, no
  hosted zone and no ACM validation.
- Both environments look the same to the reader: a wildcard domain, one
  `Gateway`, one wildcard `Secret`. The only difference is the IP in the name.
- The private CA makes the whole TLS chain visible and explicable: here is the
  issuer, here is the certificate, here is the secret the gateway serves. With
  ACM the interesting part happens somewhere you cannot look.
- Because the CA is a real CA, `make aws-trust-ca` produces a genuinely green
  padlock, which matters when a browser is on a projector.

**Negative**

- **A browser warning until the CA is trusted**, and a `curl -k` in every
  example that does not trust it. On the local cluster the documented answer is
  "use `http://`", which quietly means most local traffic is not encrypted at
  the edge (it still is inside the mesh — `PeerAuthentication` is STRICT).
- **`sslip.io` is a third party.** If it is down or blocked by a corporate
  resolver, every hostname stops resolving. `scripts/hosts-setup.sh` is the
  escape hatch and that is exactly why it was kept.
- The AWS domain **changes every time the environment is recreated**, because the
  EIPs are recreated. That is why `scripts/aws-render-env.sh` has to write the
  domain into `deploy/` and commit it (see
  [ADR 0005](0005-in-repo-gitops.md) and the runbook).
- A private CA has no revocation story and no expiry monitoring. It is a demo
  CA, generated on a laptop, with its key in `~/.agentflow/ca`.
- `sslip.io` hostnames are public DNS, so the *names* of the demo endpoints are
  visible to anyone watching DNS. The IPs were public anyway.

## Alternatives considered

**`/etc/hosts` only** — what the design started with, and still supported. One
`sudo`, one tagged line, no external dependency. Rejected as the default because
it requires a manual step on every machine, it does not help at all on AWS
(where the IP is not local), and the file has to be cleaned up afterwards.

**`nip.io`** — the same idea and equally good; `sslip.io` was picked because it
also serves the dashed form and has been the more reliable of the two. The
Makefile treats both as "public DNS, skip `/etc/hosts`".

**`.localhost` / `.test` with a local resolver (dnsmasq)** — clean, standards-
respecting, and it needs a resolver installed and configured per machine. Too
much setup for a "clone and run" repository.

**Route 53 + ACM on the NLB** — the correct production answer. Rejected because
a hosted zone at 0.50 USD/month is comparable to the entire monthly demo budget,
a registered domain is a recurring cost and an ownership question, and an ACM
certificate on an NLB means TLS terminates at the load balancer rather than at
the Istio gateway, which changes the mesh story.

**Route 53 + cert-manager with Let's Encrypt DNS-01** — real certificates, no
browser warning, and a genuinely good pattern. Rejected for the same hosted-zone
cost, plus rate limits: an environment created and destroyed several times a
week against the same wildcard name would run into Let's Encrypt's duplicate
certificate limit quickly.

**Let's Encrypt HTTP-01** — no hosted zone needed, but it requires a name Let's
Encrypt can resolve and reach. `sslip.io` names *are* resolvable, so this
technically works; rejected because it depends on the ACME server reaching a
demo cluster's ingress within a validation window, on a cluster that may be five
minutes old, and because a failed challenge blocks the whole `Gateway`.

**Self-signed per-service certificates, no CA** — no trust chain to install, and
no way to make the padlock green ever. A private CA costs one extra object and
buys `make aws-trust-ca`.

## In production I would

- **A real domain**, in Route 53, with **`external-dns`** writing records from
  `Gateway` and `VirtualService` annotations, so DNS follows the manifests
  instead of being a separate manual step.
- **ACM** on the load balancer for the public edge, with the certificate
  auto-renewed and its expiry alarmed on; or **cert-manager with Let's Encrypt
  DNS-01** if TLS must terminate at the Istio gateway (which it should, if the
  mesh is doing authorization).
- **A private CA for internal names only**, and preferably **AWS Private CA** or
  Vault PKI rather than a key on someone's laptop — with rotation, revocation
  and an audit trail.
- **Split-horizon DNS**: public names for the public edge, private hosted zone
  entries for internal services, and no admin UI on a public name at all
  (this repository already port-forwards them on AWS rather than publishing
  them).
- **Certificate expiry as a monitored SLI**, with `cert-manager`'s
  `certmanager_certificate_expiration_timestamp_seconds` alerting at 21 days.
  The most boring outage in the world is still an outage.
