import { Injectable } from '@nestjs/common';

@Injectable()
export class DatabaseConfig {
  get connectionString(): string {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL environment variable is required');
    return url;
  }
}
