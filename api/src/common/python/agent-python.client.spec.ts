import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { runAgentPython } from './agent-python.client';

jest.mock('child_process');
const mockSpawn = spawn as jest.Mock;

describe('runAgentPython (unit)', () => {
  it('should send input and handle stdout chunk', (done) => {
    // Set up mock process
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    const mockProc: any = new EventEmitter();
    mockProc.stdin = { write: jest.fn(), end: jest.fn() };
    mockProc.stdout = mockStdout;
    mockProc.stderr = mockStderr;
    mockProc.kill = jest.fn();

    // Return mock process on spawn
    mockSpawn.mockReturnValue(mockProc);

    const input = { foo: 'bar' };
    const expected = 'chunk data';
    const received: string[] = [];

    runAgentPython(input).subscribe({
      next: (chunk) => received.push(chunk),
      error: (err) => done(err),
      complete: () => {
        expect(mockSpawn).toHaveBeenCalled();
        expect(mockProc.stdin.write).toHaveBeenCalledWith(JSON.stringify(input));
        expect(mockProc.stdin.end).toHaveBeenCalled();
        expect(received).toEqual([expected]);
        done();
      },
    });

    // Simulate stdout and close
    mockStdout.emit('data', Buffer.from(expected));
    mockProc.emit('close', 0);
  });
});
