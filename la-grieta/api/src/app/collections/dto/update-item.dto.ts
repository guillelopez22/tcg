import { IsString, IsInt, Min, Max, IsIn, IsOptional } from 'class-validator';
import { CARD_CONDITIONS } from '@la-grieta/shared';

export class UpdateCollectionItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @IsOptional()
  @IsString()
  @IsIn(CARD_CONDITIONS)
  condition?: string;
}
