import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto, UpdateProviderProfileDto } from './dto/user.dto';

@ApiTags('Пользователи')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Мой профиль' })
  me(@CurrentUser() user: RequestUser) {
    return this.users.me(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновить профиль' })
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Patch('me/provider')
  @ApiOperation({ summary: 'Обновить профиль исполнителя' })
  updateProvider(@CurrentUser() user: RequestUser, @Body() dto: UpdateProviderProfileDto) {
    return this.users.updateProviderProfile(user.sub, dto);
  }
}
