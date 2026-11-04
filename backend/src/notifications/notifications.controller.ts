import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AgentAccessService } from '../common/agent-access.service';
import { NotificationsService } from './notifications.service';

class TestDto {
  @IsString() @IsNotEmpty() agentId: string;
  @IsString() @IsNotEmpty() phone: string;
}

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly access: AgentAccessService,
  ) {}

  @Post('test')
  @HttpCode(200)
  async test(@Headers('authorization') auth: string | undefined, @Body() dto: TestDto) {
    await this.access.assertCanManage(auth, dto.agentId);
    const error = await this.notifications.sendTest(dto.agentId, dto.phone);
    return { ok: !error, error };
  }
}
