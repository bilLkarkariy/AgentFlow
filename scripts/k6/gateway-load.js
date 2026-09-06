// k6 equivalent of scripts/loadgen.sh, for when the demo needs a verdict and
// not just traffic.
//
//   k6 run scripts/k6/gateway-load.js
//   k6 run -e HOST=api.1-2-3-4.sslip.io -e BASE_URL=https://1-2-3-4.sslip.io \
//          scripts/k6/gateway-load.js
//   k6 inspect scripts/k6/gateway-load.js      # options only, sends nothing
//
// Why both this and loadgen.sh: `hey` produces load, k6 produces load *and*
// pass/fail thresholds. During the canary demo loadgen.sh runs in the
// background as a metrics source; k6 is what you run when you want the shell
// to exit non-zero because the SLO was missed.
//
// The default path is /agents, not /health: the chaos middleware never fails
// /health* or /metrics, so a health-check load test would report 100 % success
// even with CHAOS_ERROR_RATE=1.

import http from 'k6/http';
import { check } from 'k6';

const HOST = __ENV.HOST || 'api.127.0.0.1.sslip.io';
const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1').replace(/\/+$/, '');
const REQUEST_PATH = __ENV.REQUEST_PATH || '/agents';
const VUS = Number(__ENV.VUS || 10);
const HOLD = __ENV.HOLD || '2m';
const RAMP = __ENV.RAMP || '30s';

export const options = {
  // Ramp to VUS, hold, ramp down. Long enough for the AnalysisRun
  // (interval 30s, failureLimit 2) to reach a verdict during the hold.
  stages: [
    { duration: RAMP, target: VUS },
    { duration: HOLD, target: VUS },
    { duration: RAMP, target: 0 },
  ],
  thresholds: {
    // Same shape as the ClusterAnalysisTemplate: latency and error ratio.
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
  // The private CA is not in k6's trust store, and the AWS demo serves
  // https://<eip>.sslip.io from it.
  insecureSkipTLSVerify: true,
  // Keep the summary readable when it is projected on a screen.
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const res = http.get(`${BASE_URL}${REQUEST_PATH}`, {
    // Istio routes on the Host header; BASE_URL is only the address dialled.
    headers: { Host: HOST },
    tags: { name: REQUEST_PATH },
  });

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'not a 5xx': (r) => r.status < 500,
  });
}

export function handleSummary(data) {
  const failed = data.metrics.http_req_failed
    ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2)
    : 'n/a';
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values['p(95)'].toFixed(0)
    : 'n/a';

  return {
    stdout: [
      '',
      `  target      ${BASE_URL}${REQUEST_PATH}  (Host: ${HOST})`,
      `  error rate  ${failed} %          threshold < 5 %`,
      `  p95         ${p95} ms            threshold < 800 ms`,
      '',
    ].join('\n'),
  };
}
