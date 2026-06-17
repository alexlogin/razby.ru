import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Уведомления')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Список уведомлений' })
  list(@CurrentUser() user: RequestUser, @Query('unread') unread?: string) {
    return this.notifications.list(user.sub, unread === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Число непрочитанных' })
  unread(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.sub);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Отметить прочитанным' })
  read(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Отметить все прочитанными' })
  readAll(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.sub);
  }
}
