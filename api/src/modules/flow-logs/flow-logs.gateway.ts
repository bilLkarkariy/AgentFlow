import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';

export interface FlowLogEvent {
  runId: string;
  nodeId: string;
  status: 'success' | 'error' | 'info';
  timestamp: number;
  message: string;
}

/** A finished run stays replayable this long for clients that join late. */
const ENDED_RUN_TTL_MS = 60_000;
/** A run that never reports its end is forgotten after this. */
const RUN_MAX_AGE_MS = 30 * 60_000;
/** Cap on the events kept per run; past it tokens are no longer kept, logs still are. */
const MAX_KEPT_EVENTS = 10_000;

interface RunHistory {
  events: [event: string, payload: unknown][];
  expiry: NodeJS.Timeout;
}

// Namespace: /ws/flow  => final URL ws://host:3000/ws/flow
@WebSocketGateway({ namespace: '/ws/flow', cors: { origin: '*' } })
export class FlowLogsGateway {
  @WebSocketServer()
  server!: Server;

  // A client learns the runId from the HTTP response that started the run,
  // so the run may already be emitting when the client joins: keep each
  // run's events to replay them on join.
  private readonly history = new Map<string, RunHistory>();

  // Client joins a room identified by runId to receive logs
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() socket: Socket,
  ): any {
    console.log(`[FlowLogsGateway] handleJoin runId=${data.runId} socket=${socket.id}`);
    socket.join(data.runId);
    for (const [event, payload] of this.history.get(data.runId)?.events ?? []) {
      socket.emit(event, payload);
    }
    // ack back to client once joined
    return { status: 'joined', runId: data.runId };
  }

  // Method used by backend services to broadcast logs
  emitLog(event: FlowLogEvent) {
    console.log(`[FlowLogsGateway] emitLog to runId=${event.runId} node=${event.nodeId} status=${event.status}`);
    this.send(event.runId, 'log', event);
  }

  // One streamed chunk of a run's output
  emitToken(runId: string, token: string) {
    this.send(runId, 'tokens', token);
  }

  // The run is over: its events stay replayable for a short while only
  endRun(runId: string) {
    this.expire(runId, ENDED_RUN_TTL_MS);
  }

  // Forward tokens on WebSocket when format=ws is used
  @OnEvent('tokens')
  handleToken({ runId, token }: { runId: string; token: string }) {
    this.server.to(runId).emit('tokens', token);
  }

  private send(runId: string, event: string, payload: unknown) {
    let history = this.history.get(runId);
    if (!history) {
      history = { events: [], expiry: this.timer(runId, RUN_MAX_AGE_MS) };
      this.history.set(runId, history);
    }
    if (event !== 'tokens' || history.events.length < MAX_KEPT_EVENTS) {
      history.events.push([event, payload]);
    }
    this.server.to(runId).emit(event, payload);
  }

  private expire(runId: string, afterMs: number) {
    const history = this.history.get(runId);
    if (!history) return;
    clearTimeout(history.expiry);
    history.expiry = this.timer(runId, afterMs);
  }

  private timer(runId: string, afterMs: number): NodeJS.Timeout {
    // unref: a pending expiry must not keep the process alive on shutdown
    return setTimeout(() => this.history.delete(runId), afterMs).unref();
  }
}
