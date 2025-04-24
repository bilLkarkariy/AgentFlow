import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';

@WebSocketGateway({ path: '/ws/flow', cors: true })
export class FlowGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly rabbit: RabbitMQService) {}

  handleConnection(client: Socket) {
    // client connected
    console.log(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { runId: string }) {
    client.join(data.runId);
  }

  async onModuleInit() {
    this.rabbit.subscribe('email.received', payload => {
      const { runId, subject } = payload;
      this.server.to(runId).emit('log', {
        runId,
        nodeId: 'email.received',
        status: 'info',
        timestamp: Date.now(),
        message: subject,
      });
    });
  }
}
