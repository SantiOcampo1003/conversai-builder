import { Controller, Post, Body, Get } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async handleMessage(@Body() dto: ChatMessageDto): Promise<ChatResponseDto> {
    return this.chatService.handleMessage(dto);
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'conversai-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
