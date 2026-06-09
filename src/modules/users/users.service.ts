import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { plainToClass } from 'class-transformer';
import * as fs from 'fs';
import { Repository, IsNull, Like, Not } from 'typeorm';

import { PageMetaDto, ResponseItem, ResponsePaginate } from '@app/common/dtos';
import { convertPath } from '@app/common/utils';
import { UserStatusEnum } from '@Constant/enums';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from '@UsersModule/dto/create-user.dto';
import { GetUsersDto } from '@UsersModule/dto/get-users.dto';
import { UpdateUserDto } from '@UsersModule/dto/update-user.dto';
import { UserEntity } from '@app/entities';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileDto } from './dto/profile.dto';
import { UserDto } from './dto/user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { avtPathName, baseImageUrl } from '@Constant/url';

@Injectable()
export class UsersService {
  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  async create(avatar, params: CreateUserDto): Promise<ResponseItem<UserDto>> {
    const emailExisted = await this.userRepository.findOne({
      where: {
        email: params.email,
        deletedAt: IsNull(),
      },
    });
    if (emailExisted) throw new BadRequestException('Email already exists');

    const existPhone = await this.userRepository.findOne({
      where: {
        phone: params.phone,
        deletedAt: IsNull(),
      },
    });
    if (existPhone) throw new BadRequestException('Phone number already exists');

    let avatarPath = null;
    if (avatar) {
      avatarPath = avtPathName('users', avatar.filename);
    }

    const newUser = this.userRepository.create({
      ...params,
      status: params.status || UserStatusEnum.ACTIVE,
      avatar: avatarPath,
    });
    const savedUser = await this.userRepository.save(newUser);

    return new ResponseItem(savedUser, 'User created successfully');
  }

  async resetPassword(id: string): Promise<ResponseItem<UserDto>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }
    const plainResetPassword = this.configService.get<string>('RESET_PASSWORD') || '123456';
    const newPassword = await bcrypt.hash(plainResetPassword, 10);

    user.password = newPassword;
    await this.userRepository.save(user);

    const result = {
      ...user,
      password: plainResetPassword,
    };

    return new ResponseItem(result, 'Password reset successfully');
  }

  async changePassword(id: string, data: ChangePasswordDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user || !bcrypt.compareSync(data.oldPassword, user.password)) {
      throw new BadRequestException('Old password is incorrect');
    }

    const password = await bcrypt.hash(data.newPassword, 10);
    user.password = password;
    await this.userRepository.save(user);

    return new ResponseItem(user, 'Password changed successfully');
  }

  async getUsers(params: GetUsersDto): Promise<ResponsePaginate<UserDto>> {
    const qb = this.userRepository.createQueryBuilder('user')
      .where('user.deletedAt IS NULL');

    if (params.status) {
      qb.andWhere('user.status = :status', { status: params.status });
    } else {
      qb.andWhere('user.status IN (:...statuses)', {
        statuses: [
          UserStatusEnum.ACTIVE,
          UserStatusEnum.INACTIVE,
          UserStatusEnum.BLOCKED,
          UserStatusEnum.PENDING_VERIFICATION
        ],
      });
    }

    if (params.search) {
      qb.andWhere('(LOWER(user.name) LIKE :search OR LOWER(user.email) LIKE :search)', {
        search: `%${params.search.toLowerCase()}%`,
      });
    }

    // Sorting
    const orderBy = params.orderBy || 'createdAt';
    const order = params.order || 'DESC';
    qb.orderBy(`user.${orderBy}`, order);

    // Pagination
    const total = await qb.getCount();
    const skip = params.skip || 0;
    const take = params.take || 10;
    
    const result = await qb
      .skip(skip)
      .take(take)
      .getMany();

    const pageMetaDto = new PageMetaDto({ itemCount: total, pageOptionsDto: params });

    return new ResponsePaginate(result, pageMetaDto, 'Success');
  }

  async getUser(id: string): Promise<ResponseItem<UserDto>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) throw new BadRequestException('Employee does not exist');

    return new ResponseItem(
      { ...user, avatar: user.avatar ? baseImageUrl + convertPath(user.avatar) : null },
      'Success'
    );
  }

  async getProfile(id: string): Promise<ResponseItem<ProfileDto>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new BadRequestException('User does not exist');

    const result = plainToClass(
      ProfileDto,
      { ...user, avatar: user.avatar ? baseImageUrl + convertPath(user.avatar) : null },
      { excludeExtraneousValues: true }
    );

    return new ResponseItem(result, 'Thành công');
  }

  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) {
      throw new BadRequestException('Profile information does not exist');
    }

    if (updateUserDto.phone) {
      const phoneExisted = await this.userRepository.findOne({
        where: {
          phone: updateUserDto.phone,
          id: Not(id),
          deletedAt: IsNull(),
        },
      });
      if (phoneExisted) {
        throw new BadRequestException('Phone number already exists');
      }
    }

    const updatedFields = plainToClass(UpdateUserDto, updateUserDto, { excludeExtraneousValues: true });

    Object.assign(user, updatedFields);
    await this.userRepository.save(user);

    return new ResponseItem(user, 'User updated successfully');
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }

    const emailExisted = await this.userRepository.findOne({
      where: {
        email: updateUserDto.email,
        id: Not(id),
        deletedAt: IsNull(),
      },
    });
    if (emailExisted) throw new BadRequestException('Email already exists');

    if (updateUserDto.phone) {
      const phoneExisted = await this.userRepository.findOne({
        where: {
          phone: updateUserDto.phone,
          id: Not(id),
          deletedAt: IsNull(),
        },
      });
      if (phoneExisted) {
        throw new BadRequestException('Phone number already exists');
      }
    }

    const updatedFields = plainToClass(UpdateUserDto, updateUserDto, { excludeExtraneousValues: true });

    Object.assign(user, updatedFields);
    await this.userRepository.save(user);

    return new ResponseItem(user, 'User updated successfully');
  }

  async deleteUser(id: string): Promise<ResponseItem<null>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) throw new BadRequestException('User does not exist');
    if (user.status === UserStatusEnum.ACTIVE) throw new BadRequestException('Cannot delete an active employee');

    user.deletedAt = new Date();
    await this.userRepository.save(user);

    return new ResponseItem(null, 'Employee deleted successfully');
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<ResponseItem<any>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }

    const oldAvatar = user.avatar;
    user.avatar = avtPathName('users', file.filename);
    await this.userRepository.save(user);

    if (oldAvatar && fs.existsSync(oldAvatar)) {
      fs.unlinkSync(oldAvatar);
    }

    return new ResponseItem(null, 'Avatar updated successfully');
  }

  async removeAvatar(id: string): Promise<ResponseItem<any>> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }

    const oldAvatar = user.avatar;
    user.avatar = null;
    await this.userRepository.save(user);

    if (oldAvatar && fs.existsSync(oldAvatar)) {
      fs.unlinkSync(oldAvatar);
    }

    return new ResponseItem(null, 'Avatar removed successfully');
  }

  async searchUsers(searchDto: SearchUsersDto): Promise<ResponseItem<any[]>> {
    const { query, limit = 10 } = searchDto;
    const searchTerm = `%${query.toLowerCase()}%`;

    const users = await this.userRepository.find({
      where: [
        { email: Like(searchTerm), deletedAt: IsNull() },
        { name: Like(searchTerm), deletedAt: IsNull() },
      ],
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const userDtos = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || undefined,
    }));

    return new ResponseItem<any[]>(userDtos, 'Users searched successfully');
  }
}
