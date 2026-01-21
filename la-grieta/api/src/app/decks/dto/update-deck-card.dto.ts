import { IsInt, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';

const DECK_ZONES = ['MAIN', 'RUNE', 'BATTLEFIELD'];

export class UpdateDeckCardDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  quantity?: number;

  @IsOptional()
  @IsString()
  @IsIn(DECK_ZONES)
  zone?: string;
}
