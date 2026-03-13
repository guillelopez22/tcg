import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisConfig {
  get url(): string {
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL environment variable is required');
    return url;
  }
}
