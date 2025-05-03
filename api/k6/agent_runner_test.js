import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 10 }, // montée en charge jusqu’à 10 vus
    { duration: '30s', target: 10 }, // maintien
    { duration: '15s', target: 0 },  // redescente
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const url = 'http://localhost:3000/agent/run';
  const payload = JSON.stringify({ prompt: 'Hello from k6' });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(url, payload, params);
  check(res, {
    'status is 201': (r) => r.status === 201,
    'body not empty': (r) => r.body && r.body.length > 0,
  });
  sleep(1);
}