import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { MatchService } from './match.service';

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/match',
  pingInterval: 15000,
  pingTimeout: 30000,
})
export class MatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly matchService: MatchService) {}

  async handleConnection(client: Socket): Promise<void> {
    const code = client.handshake.query['code'];
    if (typeof code !== 'string' || !code) {
      client.disconnect();
      return;
    }

    void client.join(code);

    try {
      const state = await this.matchService.getFullState(code);
      client.emit('state:full', state);
    } catch {
      client.emit('error', { message: 'Match not found' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const code = client.handshake.query['code'];
    if (typeof code === 'string' && code) {
      this.server.to(code).emit('player:disconnected', { socketId: client.id });
    }
  }

  @SubscribeMessage('battlefield:tap')
  async handleBattlefieldTap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; battlefieldIndex: number; playerId: string },
  ): Promise<void> {
    try {
      const newState = await this.matchService.applyBattlefieldTap(data.code, {
        battlefieldIndex: data.battlefieldIndex,
        playerId: data.playerId,
      });
      this.server.to(data.code).emit('state:patch', newState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('battlefield:submit')
  async handleBattlefieldSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; playerId: string; cardIds: string[] },
  ): Promise<void> {
    try {
      const result = await this.matchService.submitBattlefieldSelection(
        data.code,
        data.playerId,
        data.cardIds,
      );

      // Acknowledge ONLY to the submitting client
      client.emit('battlefield:submitted', { playerId: data.playerId });

      // If all players have submitted, reveal battlefields to everyone
      if (result.allSubmitted) {
        const revealedState = await this.matchService.revealBattlefields(data.code);
        this.server.to(data.code).emit('battlefield:reveal', revealedState);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('phase:advance')
  async handlePhaseAdvance(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; playerId: string },
  ): Promise<void> {
    try {
      const newState = await this.matchService.advancePhase(data.code, data.playerId);
      this.server.to(data.code).emit('state:patch', newState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('turn:advance')
  async handleTurnAdvance(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string },
  ): Promise<void> {
    try {
      const newState = await this.matchService.advanceTurn(data.code);
      this.server.to(data.code).emit('state:patch', newState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('match:pause')
  async handleMatchPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string },
  ): Promise<void> {
    try {
      const newState = await this.matchService.pauseMatch(data.code);
      this.server.to(data.code).emit('state:patch', newState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('match:end')
  async handleMatchEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; winnerId: string | null; reason: 'score' | 'concession' },
  ): Promise<void> {
    try {
      const summary = await this.matchService.endMatch(data.code, data.winnerId, data.reason);
      this.server.to(data.code).emit('match:ended', summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('match:undo')
  async handleMatchUndo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string },
  ): Promise<void> {
    try {
      const match = await this.matchService.getFullState(data.code);
      const state = match.state as unknown as {
        previousBattlefields?: unknown[];
        battlefields: unknown[];
      };

      if (state.previousBattlefields) {
        const restoredState = {
          ...state,
          battlefields: state.previousBattlefields,
          previousBattlefields: undefined,
        };

        // We push this state update through applyBattlefieldTap is not applicable here,
        // so we return the current state as-is since undo restores from previousBattlefields.
        // The gateway emits state:patch with the restored state.
        this.server.to(data.code).emit('state:patch', restoredState);
      } else {
        client.emit('error', { message: 'No previous state to undo' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }
}
