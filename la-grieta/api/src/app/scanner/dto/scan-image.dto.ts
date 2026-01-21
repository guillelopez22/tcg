import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class ScanImageDto {
  @IsString()
  @IsNotEmpty()
  image: string; // Base64 encoded image

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/jpg', 'image/webp'])
  mimeType: string;
}
