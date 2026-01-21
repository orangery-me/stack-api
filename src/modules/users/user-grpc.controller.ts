import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { ResponseItem } from '@app/common/dtos';
import { UsersService } from './users.service';
import { ProfileDto } from './dto/profile.dto';

interface GetUserByIdRequest {
  userId: string;
}

interface GetUserByIdResponse {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

@Controller()
export class UserGrpcController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('UsersService', 'GetUserById')
  async getUserById(data: GetUserByIdRequest): Promise<GetUserByIdResponse> {
    try {
      const result = await this.usersService.getProfile(data.userId);
      const normalized = new ResponseItem(result?.data as ProfileDto, result?.message, ProfileDto);
      const profile = normalized?.data as ProfileDto;
      console.log('profile day ', profile);

      if (!profile) {
        throw new Error('User profile not found');
      }

      return {
        id: data.userId,
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar || null,
      };
    } catch (error: any) {
      throw new RpcException(error?.message || 'Failed to fetch user profile');
    }
  }
}
