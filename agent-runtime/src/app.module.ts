import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AgentController } from './controllers/agent.controller';
import { AgentService } from './services/agent.service';
import { AgentGrpcController } from './controllers/agent.grpc.controller';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ClientsModule.register([{
      name: 'AGENT_PACKAGE',
      transport: Transport.GRPC,
      options: {
        url: process.env.CREW_RUNTIME_URL || 'localhost:50051',
        package: 'agent',
        protoPath: join(__dirname, '../proto/agent.proto'),
      },
    }]),
  ],
  controllers: [AgentController, AgentGrpcController],
  providers: [AgentService],
})
export class AppModule {}
