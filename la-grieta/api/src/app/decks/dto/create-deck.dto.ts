import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class CreateDeckDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  legendId: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
