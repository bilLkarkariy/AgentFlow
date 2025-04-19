import { Injectable, BadRequestException } from '@nestjs/common';

export interface AgentDsl {
  name: string;
  trigger: {
    type: 'gmail.new_email';
    filter: { from: string };
  };
  action: {
    type: 'gmail.read_subject';
    target: 'last';
  };
}

@Injectable()
export class DslParserService {
  /**
   * Parse a very constrained French prompt and returns minimal DSL.
   * Example supported: « Quand je reçois un email de alice@example.com, lis le sujet »
   */
  parsePrompt(prompt: string): AgentDsl {
    const regex = /reçois un email de\s+([\w.+-]+@[\w.-]+)/i;
    const match = prompt.match(regex);
    if (!match) {
      throw new BadRequestException('Prompt non reconnu');
    }
    const email = match[1];
    return {
      name: `Email ${email} → Sujet`,
      trigger: {
        type: 'gmail.new_email',
        filter: { from: email },
      },
      action: {
        type: 'gmail.read_subject',
        target: 'last',
      },
    };
  }
}
