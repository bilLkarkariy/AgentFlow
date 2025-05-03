import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';

interface FlowLogEvent {
  runId: string;
  nodeId: string;
  status: 'success' | 'error' | 'info';
  timestamp: number;
  message: string;
}

// Namespace: /ws/flow  => final URL ws://host:3000/ws/flow
@WebSocketGateway({ namespace: '/ws/flow', cors: { origin: '*' } })
export class FlowLogsGateway {
  @WebSocketServer()
  server!: Server;

  // Client joins a room identified by runId to receive logs
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() socket: Socket,
  ): any {
    console.log(`[FlowLogsGateway] handleJoin runId=${data.runId} socket=${socket.id}`);
    socket.join(data.runId);
    // ack back to client once joined
    return { status: 'joined', runId: data.runId };
  }

  // Method used by backend services to broadcast logs
  emitLog(event: FlowLogEvent) {
    console.log(`[FlowLogsGateway] emitLog to runId=${event.runId} message=${event.message}`);
    this.server.to(event.runId).emit('log', event);
  }

  // Forward tokens on WebSocket when format=ws is used
  @OnEvent('tokens')
  handleToken({ runId, token }: { runId: string; token: string }) {
    this.server.to(runId).emit('tokens', token);
  }
}
