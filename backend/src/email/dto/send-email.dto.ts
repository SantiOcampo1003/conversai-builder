import { IsString, IsEmail, IsObject, IsNotEmpty } from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsObject()
  @IsNotEmpty()
  params: Record<string, any>;
}
