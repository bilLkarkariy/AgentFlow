import { Injectable } from '@nestjs/common';

@Injectable()
export class SummarizeService {
  run(payload: { text: string }) {
    return { summary: `Résumé automatique: ${payload.text}` };
  }
}
