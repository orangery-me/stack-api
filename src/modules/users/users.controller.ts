import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam, ApiQuery } from '@nestjs/swagger';

import { ResponseItem, ResponsePaginate } from '@app/common/dtos';
import { fileOption } from '@app/config/image-multer-config';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetUsersDto } from '@UsersModule/dto/get-users.dto';
import { UpdateUserDto } from '@UsersModule/dto/update-user.dto';
import { UsersService } from '@UsersModule/users.service';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileDto } from './dto/profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UserDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAccessTokenGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'User created successfully', type: UserDto })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @UseInterceptors(FileInterceptor('avatar', fileOption('users')))
  async create(
    @UploadedFile()
    avatar: Express.Multer.File,
    @Body() createUserDto
  ) {
    if (!avatar && createUserDto.containFile === 'true') {
      throw new BadRequestException('Invalid image');
    }
    return await this.usersService.create(avatar, createUserDto);
  }

  @Patch('reset-password/:id')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({ status: 200, description: 'Password reset successfully', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Param('id') id: string): Promise<ResponseItem<UserDto>> {
    return await this.usersService.resetPassword(id);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Old password is incorrect' })
  async changePassword(@Req() req, @Body() changePasswordDto: ChangePasswordDto): Promise<ResponseItem<UserDto>> {
    return await this.usersService.changePassword(req.user.userId, changePasswordDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of users' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'take', required: false, description: 'Number of records per page', type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword', type: String })
  @ApiResponse({ status: 200, description: 'Users fetched successfully' })
  async getUsers(@Query() getUsersDto: GetUsersDto): Promise<ResponsePaginate<UserDto>> {
    return await this.usersService.getUsers(getUsersDto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by email or name' })
  @ApiQuery({ name: 'query', required: true, description: 'Search keyword', type: String })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Search successful',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          avatar: { type: 'string', nullable: true },
        },
      },
    },
  })
  async searchUsers(@Query() searchDto: SearchUsersDto): Promise<ResponseItem<any[]>> {
    return await this.usersService.searchUsers(searchDto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile fetched successfully', type: ProfileDto })
  async getProfile(@Req() req): Promise<ResponseItem<ProfileDto>> {
    return await this.usersService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully', type: UserDto })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async updateProfile(@Req() req, @Body() updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    return await this.usersService.updateProfile(req.user.userId, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({ status: 200, description: 'Deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string): Promise<ResponseItem<null>> {
    return await this.usersService.deleteUser(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({ status: 200, description: 'User fetched successfully', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id') id: string): Promise<ResponseItem<UserDto>> {
    return await this.usersService.getUser(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user information' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({ status: 200, description: 'Updated successfully', type: UserDto })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<ResponseItem<UserDto>> {
    return await this.usersService.update(id, updateUserDto);
  }

  @Post('avatar/:id')
  @ApiOperation({ summary: 'Upload avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({ status: 200, description: 'Uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @UseInterceptors(FileInterceptor('avatar', fileOption('users')))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile()
    avatar: Express.Multer.File
  ): Promise<any> {
    if (avatar) {
      return await this.usersService.uploadAvatar(id, avatar);
    }
    throw new BadRequestException('Invalid image');
  }

  @Patch('avatar/:id')
  @ApiOperation({ summary: 'Remove avatar' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({ status: 200, description: 'Avatar removed successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async removeAvatar(@Param('id') id: string): Promise<ResponseItem<UserDto>> {
    return await this.usersService.removeAvatar(id);
  }
}
