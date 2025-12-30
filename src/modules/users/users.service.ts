import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { plainToClass } from 'class-transformer';
import * as fs from 'fs';
import { Model } from 'mongoose';

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
import { avtPathName, baseImageUrl } from '@Constant/url';

@Injectable()
export class UsersService {
  constructor(
    private readonly configService: ConfigService,

    @InjectModel(UserEntity.name)
    private readonly userModel: Model<UserEntity>
  ) {}

  async create(avatar, params: CreateUserDto): Promise<ResponseItem<UserDto>> {
    const emailExisted = await this.userModel.findOne({
      email: params.email,
      deletedAt: null,
    });
    if (emailExisted) throw new BadRequestException('Email đã tồn tại');

    const identityIdExisted = await this.userModel.findOne({
      identityId: params.identityId,
      deletedAt: null,
    });
    if (identityIdExisted) {
      throw new BadRequestException('CMND/CCCD đã tồn tại');
    }

    const existPhone = await this.userModel.findOne({
      phone: params.phone,
      deletedAt: null,
    });
    if (existPhone) throw new BadRequestException('Số điện thoại đã tồn tại');

    if (avatar) {
      params = { ...params, avatar: avtPathName('users', avatar.filename) };
    } else {
      params = { ...params, avatar: null };
    }

    const user = new this.userModel(params);
    await user.save();

    return new ResponseItem(user, 'Tạo mới dữ liệu thành công');
  }

  async resetPassword(id: string): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) {
      throw new BadRequestException('Nhân viên không tồn tại');
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

    return new ResponseItem(result, 'Đặt lại mật khẩu thành công');
  }

  async changePassword(id: string, data: ChangePasswordDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user || !bcrypt.compareSync(data.oldPassword, user.password)) {
      throw new BadRequestException('Mật khẩu cũ không chính xác');
    }

    const password = await bcrypt.hash(data.newPassword, 10);
    await this.userModel.updateOne({ _id: id }, { password });

    return new ResponseItem(user, 'Thay đổi mật khẩu thành công');
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

    return new ResponsePaginate(result, pageMetaDto, 'Thành công');
  }

  async getUser(id: string): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({
      _id: id,
      deletedAt: null,
    });
    if (!user) throw new BadRequestException('Nhân viên không tồn tại');

    return new ResponseItem(
      { ...user.toObject(), avatar: user.avatar ? baseImageUrl + convertPath(user.avatar) : null },
      'Thành công'
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
      throw new BadRequestException('Thông tin cá nhân không tồn tại');
    }

    const identityIdExisted = await this.userModel.findOne({
      identityId: updateUserDto.identityId,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (identityIdExisted) {
      throw new BadRequestException('CMND/CCCD đã tồn tại');
    }

    const phoneExisted = await this.userModel.findOne({
      phone: updateUserDto.phone,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (phoneExisted) {
      throw new BadRequestException('Số điện thoại đã tồn tại');
    }

    await this.userModel.updateOne(
      { _id: id },
      {
        ...plainToClass(UpdateUserDto, updateUserDto, { excludeExtraneousValues: true }),
      }
    );

    const result = await this.userModel.findOne({ _id: id, deletedAt: null });

    return new ResponseItem(result, 'Cập nhật dữ liệu thành công');
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) {
      throw new BadRequestException('Nhân viên không tồn tại');
    }

    const emailExisted = await this.userModel.findOne({
      email: updateUserDto.email,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (emailExisted) throw new BadRequestException('Email đã tồn tại');

    const identityIdExisted = await this.userModel.findOne({
      identityId: updateUserDto.identityId,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (identityIdExisted) {
      throw new BadRequestException('CMND/CCCD đã tồn tại');
    }

    const phoneExisted = await this.userModel.findOne({
      phone: updateUserDto.phone,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (phoneExisted) {
      throw new BadRequestException('Số điện thoại đã tồn tại');
    }

    await this.userModel.updateOne(
      { _id: id },
      {
        ...plainToClass(UpdateUserDto, updateUserDto, { excludeExtraneousValues: true }),
      }
    );

    const result = await this.userModel.findOne({ _id: id, deletedAt: null });

    return new ResponseItem(result, 'Cập nhật dữ liệu thành công');
  }

  async deleteUser(id: string): Promise<ResponseItem<null>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new BadRequestException('Người dùng không tồn tại');
    if (user.status === UserStatusEnum.ACTIVE) throw new BadRequestException('Không được xóa nhân viên đang hoạt động');

    await this.userModel.updateOne({ _id: id }, { deletedAt: new Date() });

    return new ResponseItem(null, 'Xóa nhân viên thành công');
  }

  async uploadAvatar(identityId: string, file: Express.Multer.File): Promise<ResponseItem<any>> {
    const user = await this.userModel.findOne({ identityId, deletedAt: null });

    if (!user) {
      throw new BadRequestException('Nhân viên không tồn tại');
    }

    await this.userModel.updateOne({ identityId }, { avatar: avtPathName('users', file.filename) });

    if (fs.existsSync(user.avatar)) {
      fs.unlinkSync(user.avatar);
    }

    return new ResponseItem(null, 'Cập nhật thông tin thành công');
  }

  async removeAvatar(identityId: string): Promise<ResponseItem<any>> {
    const user = await this.userModel.findOne({ identityId, deletedAt: null });

    if (!user) {
      throw new BadRequestException('Nhân viên không tồn tại');
    }

    await this.userModel.updateOne({ identityId }, { avatar: null });

    if (fs.existsSync(user.avatar)) {
      fs.unlinkSync(user.avatar);
    }

    return new ResponseItem(null, 'Xóa ảnh đại diện thành công');
  }
}
