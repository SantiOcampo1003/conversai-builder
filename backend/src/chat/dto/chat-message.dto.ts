import { IsString, IsNotEmpty } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  messageText: string;
}
