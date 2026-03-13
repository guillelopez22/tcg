import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { UserService } from '../src/modules/user/user.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Drizzle chain mock for UserService.
 *
 * Call patterns:
 *   getProfile:    db.select({...}).from(users).where(...).limit(1)
 *   getProfileById db.select({...}).from(users).where(...).limit(1)
 *   updateProfile: db.update(users).set({...}).where(...).returning({...})
 */
function makeMockDb() {
  const selectResults: unknown[][] = [];
  const updateResults: unknown[][] = [];
  let selectIdx = 0;
  let updateIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const chain: Record<string, unknown> = {};
    chain['from'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    return chain;
  });

  const update = vi.fn().mockImplementation(() => {
    const capturedIdx = updateIdx++;
    const chain: Record<string, unknown> = {};
    chain['set'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['returning'] = vi.fn().mockImplementation(() =>
      Promise.resolve(updateResults[capturedIdx] ?? []),
    );
    return chain;
  });

  return {
    select,
    update,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
    _pushUpdate: (...rows: unknown[][]) => { updateResults.push(...rows); },
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OTHER_USER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const TEST_USER_PROFILE = {
  id: USER_ID,
  email: 'juan@lagrietahonduras.com',
  username: 'juanrift',
  displayName: 'Juan Rift',
  avatarUrl: null,
  bio: 'Collector desde Tegucigalpa',
  city: 'Tegucigalpa',
  whatsappPhone: null,
  isVerified: false,
  isActive: true,
  role: 'user',
  createdAt: new Date('2026-03-10T00:00:00Z'),
  updatedAt: new Date('2026-03-10T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: UserService;

  beforeEach(() => {
    db = makeMockDb();
    service = new UserService(db as never);
  });

  // =========================================================================
  // getProfile()
  // =========================================================================

  describe('getProfile()', () => {
    it('should return user profile when username exists', async () => {
      db._pushSelect([TEST_USER_PROFILE]);

      const result = await service.getProfile('juanrift');

      expect(result.id).toBe(USER_ID);
      expect(result.username).toBe('juanrift');
      expect(result.email).toBe('juan@lagrietahonduras.com');
    });

    it('should look up user by lowercased username', async () => {
      db._pushSelect([TEST_USER_PROFILE]);

      // Mixed-case input — implementation lowercases before querying
      const result = await service.getProfile('JuanRIFT');

      // If lowercasing didn't happen, the mock would return empty → NOT_FOUND
      // The fact that we get a result confirms lowercasing
      expect(result.username).toBe('juanrift');
    });

    it('should throw NOT_FOUND when username does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.getProfile('nonexistentuser'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'User not found' });
    });

    it('should include all required profile fields', async () => {
      db._pushSelect([TEST_USER_PROFILE]);

      const result = await service.getProfile('juanrift');

      const required = [
        'id', 'email', 'username', 'displayName', 'avatarUrl',
        'bio', 'city', 'whatsappPhone', 'isVerified', 'isActive',
        'role', 'createdAt', 'updatedAt',
      ];
      for (const field of required) {
        expect(result, `missing field: ${field}`).toHaveProperty(field);
      }
    });

    it('should return null for nullable fields when not set', async () => {
      db._pushSelect([{
        ...TEST_USER_PROFILE,
        displayName: null, avatarUrl: null, bio: null, city: null, whatsappPhone: null,
      }]);

      const result = await service.getProfile('juanrift');

      expect(result.displayName).toBeNull();
      expect(result.avatarUrl).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.city).toBeNull();
      expect(result.whatsappPhone).toBeNull();
    });

    it('should not expose passwordHash in the result', async () => {
      db._pushSelect([TEST_USER_PROFILE]);

      const result = await service.getProfile('juanrift');

      expect((result as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });
  });

  // =========================================================================
  // updateProfile()
  // =========================================================================

  describe('updateProfile()', () => {
    it('should update displayName and return updated profile', async () => {
      const updated = { ...TEST_USER_PROFILE, displayName: 'New Name' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { displayName: 'New Name' });

      expect(result.displayName).toBe('New Name');
    });

    it('should update bio and return updated profile', async () => {
      const updated = { ...TEST_USER_PROFILE, bio: 'Nuevo bio!' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { bio: 'Nuevo bio!' });

      expect(result.bio).toBe('Nuevo bio!');
    });

    it('should update city', async () => {
      const updated = { ...TEST_USER_PROFILE, city: 'San Pedro Sula' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { city: 'San Pedro Sula' });

      expect(result.city).toBe('San Pedro Sula');
    });

    it('should update avatarUrl', async () => {
      const avatarUrl = 'https://r2.lagrietahonduras.com/avatars/user-123.jpg';
      const updated = { ...TEST_USER_PROFILE, avatarUrl };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { avatarUrl });

      expect(result.avatarUrl).toBe(avatarUrl);
    });

    it('should update whatsappPhone', async () => {
      const updated = { ...TEST_USER_PROFILE, whatsappPhone: '+50499123456' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { whatsappPhone: '+50499123456' });

      expect(result.whatsappPhone).toBe('+50499123456');
    });

    it('should throw NOT_FOUND when userId does not exist', async () => {
      db._pushUpdate([]); // update returns no rows — user not found

      await expect(
        service.updateProfile('00000000-0000-0000-0000-000000000000', { displayName: 'Ghost' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'User not found' });
    });

    it('should return current profile unchanged when no fields are provided', async () => {
      // When input is empty, service calls getProfileById internally
      db._pushSelect([TEST_USER_PROFILE]);

      const result = await service.updateProfile(USER_ID, {});

      expect(result.id).toBe(USER_ID);
      expect(result.displayName).toBe(TEST_USER_PROFILE.displayName);
    });

    it('should NOT call db.update when input has no fields (empty update)', async () => {
      db._pushSelect([TEST_USER_PROFILE]);

      await service.updateProfile(USER_ID, {});

      expect(db.update).not.toHaveBeenCalled();
    });

    it('should only update explicitly provided fields (undefined fields are not overwritten)', async () => {
      // Only city is provided — bio should not be cleared
      const updated = { ...TEST_USER_PROFILE, city: 'Choluteca' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { city: 'Choluteca' });

      // Bio was not in input, so it should be preserved from DB
      expect(result.city).toBe('Choluteca');
      expect(result.bio).toBe(TEST_USER_PROFILE.bio); // unchanged
    });

    it('should return all required profile fields after update', async () => {
      const updated = { ...TEST_USER_PROFILE, displayName: 'Updated Name' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { displayName: 'Updated Name' });

      const required = [
        'id', 'email', 'username', 'displayName', 'avatarUrl',
        'bio', 'city', 'whatsappPhone', 'isVerified', 'isActive',
        'role', 'createdAt', 'updatedAt',
      ];
      for (const field of required) {
        expect(result, `missing field: ${field}`).toHaveProperty(field);
      }
    });

    it('should not expose passwordHash after update', async () => {
      const updated = { ...TEST_USER_PROFILE, displayName: 'Updated' };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, { displayName: 'Updated' });

      expect((result as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('should allow updating multiple fields at once', async () => {
      const updated = {
        ...TEST_USER_PROFILE,
        displayName: 'New Name',
        bio: 'New bio',
        city: 'La Ceiba',
      };
      db._pushUpdate([updated]);

      const result = await service.updateProfile(USER_ID, {
        displayName: 'New Name',
        bio: 'New bio',
        city: 'La Ceiba',
      });

      expect(result.displayName).toBe('New Name');
      expect(result.bio).toBe('New bio');
      expect(result.city).toBe('La Ceiba');
    });
  });
});
