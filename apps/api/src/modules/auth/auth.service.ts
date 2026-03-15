import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import type { Response } from 'express';
import type { DbClient } from '@la-grieta/db';
import { users, sessions } from '@la-grieta/db';
import type { Redis } from 'ioredis';
import type { RegisterInput, LoginInput, JwtPayload } from '@la-grieta/shared';
import { AuthConfig } from '../../config/auth.config';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    role: string;
  };
  accessToken: string;
}

const BCRYPT_ROUNDS = 12;
// Grace period for concurrent tab refresh races (30 seconds)
const REFRESH_GRACE_PERIOD_MS = 30_000;
// 30 days in milliseconds
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === '23505'
  );
}

function getConstraintColumn(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'constraint' in err) {
    const constraint = String((err as Record<string, unknown>)['constraint']);
    if (constraint.includes('username')) return 'username';
  }
  return 'email';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbClient,
    private readonly redis: Redis,
    private readonly authConfig: AuthConfig,
  ) {}

  async register(input: RegisterInput, res: Response): Promise<AuthResult> {
    const existingEmail = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (existingEmail.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Registration failed — email or username may already be in use' });
    }

    const existingUsername = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, input.username.toLowerCase()))
      .limit(1);

    if (existingUsername.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Registration failed — email or username may already be in use' });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    let user: { id: string; email: string; username: string; displayName: string | null; role: string } | undefined;
    try {
      const rows = await this.db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          username: input.username.toLowerCase(),
          passwordHash,
          displayName: input.displayName ?? null,
          city: input.city ?? null,
        })
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
        });
      user = rows[0];
    } catch (err) {
      // PostgreSQL unique constraint violation (code 23505)
      if (isUniqueConstraintError(err)) {
        const message = getConstraintColumn(err);
        if (message === 'username') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Registration failed — email or username may already be in use' });
        }
        throw new TRPCError({ code: 'CONFLICT', message: 'Registration failed — email or username may already be in use' });
      }
      throw err;
    }

    if (!user) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
    }

    const { accessToken, refreshToken } = await this.createSession(user.id, user.role);
    this.setRefreshCookie(res, refreshToken);

    return { user, accessToken };
  }

  async login(input: LoginInput, res: Response): Promise<AuthResult> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is deactivated' });
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = await this.createSession(user.id, user.role);
    this.setRefreshCookie(res, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      accessToken,
    };
  }

  async refresh(rawRefreshToken: string, res: Response): Promise<AuthResult> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, tokenHash),
          eq(sessions.isRevoked, false),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
    }

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found or deactivated' });
    }

    // Issue a new access token but keep the same refresh token/session.
    // Token rotation is unsafe here because the Next.js rewrite proxy may not
    // reliably forward Set-Cookie headers, causing the browser to keep the old
    // (now-revoked) token and triggering false "token reuse" on next refresh.
    const accessToken = this.signAccessToken(user.id, user.role);

    // Re-set the same refresh cookie to extend its maxAge
    this.setRefreshCookie(res, rawRefreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      accessToken,
    };
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    // Blacklist the access token in Redis until its natural expiry
    const ttlSeconds = this.authConfig.accessTokenTtlSeconds;
    await this.redis.setex(`blacklist:${accessToken}`, ttlSeconds, '1');

    // Revoke all active DB sessions for this user (H3)
    await this.db
      .update(sessions)
      .set({ isRevoked: true })
      .where(and(eq(sessions.userId, userId), eq(sessions.isRevoked, false)));
  }

  async logoutAll(userId: string, accessToken: string): Promise<void> {
    // Blacklist the current access token
    const ttlSeconds = this.authConfig.accessTokenTtlSeconds;
    await this.redis.setex(`blacklist:${accessToken}`, ttlSeconds, '1');

    // Revoke all sessions for the user
    await this.db
      .update(sessions)
      .set({ isRevoked: true })
      .where(eq(sessions.userId, userId));
  }

  async me(userId: string): Promise<{
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    city: string | null;
    whatsappPhone: string | null;
    isVerified: boolean;
    isActive: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        city: users.city,
        whatsappPhone: users.whatsappPhone,
        isVerified: users.isVerified,
        isActive: users.isActive,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return user;
  }

  private async createSession(userId: string, role: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.signAccessToken(userId, role);
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);

    const expiresAt = new Date(Date.now() + this.authConfig.refreshTokenTtlSeconds * 1000);

    await this.db.insert(sessions).values({
      userId,
      refreshToken: refreshTokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private setRefreshCookie(res: Response, rawRefreshToken: string): void {
    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie('refresh_token', rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/trpc/auth.refresh',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private signAccessToken(userId: string, role: string): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      role,
    };
    return jwt.sign(payload, this.authConfig.jwtSecret, {
      expiresIn: this.authConfig.accessTokenTtlSeconds,
    });
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
