import { Observable } from 'rxjs';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { Logger } from '@nestjs/common';

/**
 * Runs the Python agent_runner and streams stdout chunks as Observable<string>.
 */
export function runAgentPython(input: Record<string, any>): Observable<string> {
  return new Observable<string>((observer) => {
    const script = path.join(process.cwd(), 'python', 'agent_runner.py');
    const venvPython = path.join(process.cwd(), 'python', 'venv', 'bin', 'python');
    const pythonBin = existsSync(venvPython) ? venvPython : 'python';
    const proc = spawn(pythonBin, ['-u', script], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const logger = new Logger('runAgentPython');

    // Send JSON payload
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    // Stream stdout line by line
    let buffer = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      // Log each complete JSON line
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          logger.log(`agent_runner output: ${line}`);
          observer.next(line);
        }
      }
    });

    // Handle process close: flush buffer, complete or stub-end on error
    proc.on('close', (code: number) => {
      logger.log(`agent_runner exited with code ${code}`);
      if (buffer.trim()) observer.next(buffer);
      if (code === 0) {
        observer.complete();
      } else {
        observer.next(JSON.stringify({ kind: 'end' }));
        observer.complete();
      }
    });

    // Cleanup on unsubscribe
    return () => {
      if (!proc.killed) proc.kill();
    };
  });
}
