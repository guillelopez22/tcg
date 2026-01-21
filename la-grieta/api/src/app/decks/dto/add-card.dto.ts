import { IsString, IsInt, Min, Max, IsIn } from 'class-validator';

const DECK_ZONES = ['MAIN', 'RUNE', 'BATTLEFIELD'];

export class AddCardToDeckDto {
  @IsString()
  cardId: string;

  @IsInt()
  @Min(1)
  @Max(3) // Max 3 copies per zone
  quantity: number;

  @IsString()
  @IsIn(DECK_ZONES)
  zone: string;
}
