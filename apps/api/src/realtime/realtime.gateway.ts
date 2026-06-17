import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@razby/shared';

/**
 * WebSocket-шлюз. Каждый пользователь подключается в личную комнату user:<id>
 * и в комнаты проектов project:<id>. Аутентификация по access-токену.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: '/ws' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization as string)?.replace('Bearer ', '');
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('app.jwt.accessSecret'),
      });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      this.logger.debug(`WS connect user=${payload.sub}`);
    } catch {
      client.emit('error', { message: 'Не авторизован' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS disconnect ${client.id}`);
  }

  /** Подписка клиента на комнату проекта. */
  joinProject(userId: string, projectId: string): void {
    for (const [, socket] of this.server.sockets.sockets) {
      if (socket.data.userId === userId) socket.join(`project:${projectId}`);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToProject(projectId: string, event: string, payload: unknown): void {
    this.server.to(`project:${projectId}`).emit(event, payload);
  }
}
