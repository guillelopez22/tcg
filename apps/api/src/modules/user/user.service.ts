import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { users } from '@la-grieta/db';
import type { UpdateUserInput, UserOutput, PublicUserOutput } from '@la-grieta/shared';

@Injectable()
export class UserService {
  constructor(private readonly db: DbClient) {}

  async getPublicProfile(username: string): Promise<PublicUserOutput> {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        city: users.city,
        isVerified: users.isVerified,
        isActive: users.isActive,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateUserInput): Promise<UserOutput> {
    const updateData: Partial<typeof users.$inferInsert> = {};

    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
    if (input.whatsappPhone !== undefined) updateData.whatsappPhone = input.whatsappPhone;

    if (Object.keys(updateData).length === 0) {
      return this.getProfileById(userId);
    }

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
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
      });

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return updated;
  }

  async getProfileById(userId: string): Promise<UserOutput> {
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
}
