import dotenv from 'dotenv';
import path from 'path';
import { runAgentPython } from './agent-python.client';
import { toArray } from 'rxjs/operators';

// Load root .env for OPENAI_API_KEY
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

describe('runAgentPython (integration)', () => {
  const testFn = process.env.OPENAI_API_KEY ? test : test.skip;

  testFn('executes Python runner and returns non-empty output', (done) => {
    const chunks: string[] = [];

    runAgentPython({ text: 'Bonjour' })
      .pipe(toArray())
      .subscribe({
        next: (arr: string[]) => chunks.push(...arr),
        error: (err) => done(err),
        complete: () => {
          expect(chunks.length).toBeGreaterThan(0);
          chunks.forEach(chunk => expect(() => JSON.parse(chunk)).not.toThrow());
          done();
        },
      });
  }, 60000);
});
