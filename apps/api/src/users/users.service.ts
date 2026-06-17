import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, UpdateProviderProfileDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { providerProfile: true, region: true, documents: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    let regionId: string | undefined;
    if (dto.regionCode) {
      const region = await this.prisma.region.findUnique({ where: { code: dto.regionCode } });
      regionId = region?.id;
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        avatarUrl: dto.avatarUrl,
        regionId,
      },
    });
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return safe;
  }

  async updateProviderProfile(userId: string, dto: UpdateProviderProfileDto) {
    return this.prisma.providerProfile.update({
      where: { userId },
      data: {
        companyName: dto.companyName,
        inn: dto.inn,
        ogrn: dto.ogrn,
        description: dto.description,
        serviceRegionIds: dto.serviceRegionIds,
      },
    });
  }
}
