import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// import * as bcrypt from 'bcrypt';
import * as bcrypt from 'bcryptjs';
import { plainToClass } from 'class-transformer';
import * as fs from 'fs';
import { Model } from 'mongoose';
import { Repository, IsNull, Like } from 'typeorm';

import { PageMetaDto, ResponseItem, ResponsePaginate } from '@app/common/dtos';
import { convertPath } from '@app/common/utils';
import { StatusEnum, UserStatusEnum } from '@Constant/enums';
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
    private readonly userModel: Model<UserEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  async create(avatar, params: CreateUserDto): Promise<ResponseItem<UserDto>> {
    const emailExisted = await this.userModel.findOne({
      email: params.email,
      deletedAt: null,
    });
    if (emailExisted) throw new BadRequestException('Email already exists');

    const existPhone = await this.userModel.findOne({
      phone: params.phone,
      deletedAt: null,
    });
    if (existPhone) throw new BadRequestException('Phone number already exists');

    if (avatar) {
      params = { ...params, avatar: avtPathName('users', avatar.filename) };
    } else {
      params = { ...params, avatar: null };
    }

    const user = new this.userModel(params);
    await user.save();

    return new ResponseItem(user, 'User created successfully');
  }

  async resetPassword(id: string): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }
    const newPassword = await bcrypt.hash(this.configService.get<string>('RESET_PASSWORD'), 10);

    await this.userModel.updateOne(
      { _id: id },
      {
        password: newPassword,
      }
    );

    const response = await this.userModel.findOne({ _id: id, deletedAt: null });

    const result = {
      ...response.toObject(),
      password: this.configService.get<string>('RESET_PASSWORD'),
    };

    return new ResponseItem(result, 'Password reset successfully');
  }

  async changePassword(id: string, data: ChangePasswordDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user || !bcrypt.compareSync(data.oldPassword, user.password)) {
      throw new BadRequestException('Old password is incorrect');
    }

    const password = await bcrypt.hash(data.newPassword, 10);
    await this.userModel.updateOne({ _id: id }, { password });

    return new ResponseItem(user, 'Password changed successfully');
  }

  async getUsers(params: GetUsersDto): Promise<ResponsePaginate<UserDto>> {
    const statusFilter = params.status ? [params.status] : [StatusEnum.ACTIVE, StatusEnum.INACTIVE];
    const searchRegex = new RegExp(params.search || '', 'i');

    const query = this.userModel.find({
      status: { $in: statusFilter },
      name: { $regex: searchRegex },
      deletedAt: null,
    });

    const total = await this.userModel.countDocuments({
      status: { $in: statusFilter },
      name: { $regex: searchRegex },
      deletedAt: null,
    });

    const sortOrder = params.order === 'ASC' ? 1 : -1;
    const result = await query
      .sort({ [params.orderBy]: sortOrder })
      .skip(params.skip)
      .limit(params.take)
      .exec();

    const pageMetaDto = new PageMetaDto({ itemCount: total, pageOptionsDto: params });

    return new ResponsePaginate(result, pageMetaDto, 'Success');
  }

  async getUser(id: string): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({
      _id: id,
      deletedAt: null,
    });
    if (!user) throw new BadRequestException('Employee does not exist');

    return new ResponseItem(
      { ...user.toObject(), avatar: user.avatar ? baseImageUrl + convertPath(user.avatar) : null },
      'Success'
    );
  }

  async getProfile(id: string): Promise<ResponseItem<ProfileDto>> {
    const user = await this.userModel.findOne({ _id: id });

    const result = plainToClass(
      ProfileDto,
      { ...user.toObject(), avatar: user.avatar ? baseImageUrl + convertPath(user.avatar) : null },
      { excludeExtraneousValues: true }
    );

    return new ResponseItem(result, 'Thành công');
  }

  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) {
      throw new BadRequestException('Profile information does not exist');
    }

    const phoneExisted = await this.userModel.findOne({
      phone: updateUserDto.phone,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (phoneExisted) {
      throw new BadRequestException('Phone number already exists');
    }

    await this.userModel.updateOne(
      { _id: id },
      {
        ...plainToClass(UpdateUserDto, updateUserDto, { excludeExtraneousValues: true }),
      }
    );

    const result = await this.userModel.findOne({ _id: id, deletedAt: null });

    return new ResponseItem(result, 'User updated successfully');
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }

    const emailExisted = await this.userModel.findOne({
      email: updateUserDto.email,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (emailExisted) throw new BadRequestException('Email already exists');

    const phoneExisted = await this.userModel.findOne({
      phone: updateUserDto.phone,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (phoneExisted) {
      throw new BadRequestException('Phone number already exists');
    }

    await this.userModel.updateOne(
      { _id: id },
      {
        ...plainToClass(UpdateUserDto, updateUserDto, { excludeExtraneousValues: true }),
      }
    );

    const result = await this.userModel.findOne({ _id: id, deletedAt: null });

    return new ResponseItem(result, 'User updated successfully');
  }

  async deleteUser(id: string): Promise<ResponseItem<null>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new BadRequestException('User does not exist');
    if (user.status === UserStatusEnum.ACTIVE)
      throw new BadRequestException('Cannot delete an active employee');

    await this.userModel.updateOne({ _id: id }, { deletedAt: new Date() });

    return new ResponseItem(null, 'Employee deleted successfully');
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<ResponseItem<any>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });

    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }

    await this.userModel.updateOne({ _id: id }, { avatar: avtPathName('users', file.filename) });

    if (fs.existsSync(user.avatar)) {
      fs.unlinkSync(user.avatar);
    }

    return new ResponseItem(null, 'Avatar updated successfully');
  }

  async removeAvatar(id: string): Promise<ResponseItem<any>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });

    if (!user) {
      throw new BadRequestException('Employee does not exist');
    }

    await this.userModel.updateOne({ _id: id }, { avatar: null });

    if (fs.existsSync(user.avatar)) {
      fs.unlinkSync(user.avatar);
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

    // Map to simple user objects for autocomplete (not full UserDto)
    const userDtos = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || undefined,
    }));

    return new ResponseItem<UserDto[]>(userDtos, 'Users searched successfully');
  }
}
