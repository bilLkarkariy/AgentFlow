import { Injectable, BadRequestException } from '@nestjs/common';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from './schemas/agent-dsl.schema.json';

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
  private ajv = (() => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv;
  })();
  private validate = this.ajv.compile(schema);

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
    const dsl: AgentDsl = {
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
    if (!this.validate(dsl)) {
      throw new BadRequestException(
        `DSL invalide: ${this.ajv.errorsText(this.validate.errors)}`
      );
    }
    return dsl;
  }
}
