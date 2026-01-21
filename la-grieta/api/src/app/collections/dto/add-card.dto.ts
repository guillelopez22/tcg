import { IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { CARD_CONDITIONS } from '@la-grieta/shared';

export class AddCardToCollectionDto {
  @IsString()
  cardId: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @IsString()
  @IsIn(CARD_CONDITIONS)
  condition: string;
}
