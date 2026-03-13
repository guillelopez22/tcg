import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthConfig {
  get jwtSecret(): string {
    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error('JWT_SECRET environment variable is required');
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    if (secret.includes('change_me')) {
      throw new Error('JWT_SECRET contains a placeholder value — set a cryptographically random secret');
    }
    return secret;
  }

  get accessTokenTtlSeconds(): number {
    return parseInt(process.env['JWT_ACCESS_TOKEN_TTL'] ?? '900', 10);
  }

  get refreshTokenTtlSeconds(): number {
    return parseInt(process.env['JWT_REFRESH_TOKEN_TTL'] ?? '2592000', 10);
  }
}
