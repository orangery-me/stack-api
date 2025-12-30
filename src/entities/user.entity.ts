import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UserStatusEnum, UserRoleEnum } from '@Constant/enums';
import { AbstractEntity } from './abstract.entity';

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class UserEntity extends AbstractEntity {
  @Prop({ type: String, required: true, maxlength: 255 })
  email: string;

  @Prop({ type: String, required: true, maxlength: 10 })
  phone: string;

  @Prop({ type: String })
  @Exclude()
  password: string;

  @Prop({ type: String, enum: Object.values(UserStatusEnum), default: UserStatusEnum.PENDING_VERIFICATION })
  status: UserStatusEnum;

  @Prop({ type: String, enum: Object.values(UserRoleEnum), default: UserRoleEnum.USER })
  role: UserRoleEnum;

  @Prop({ type: String, required: true, maxlength: 50 })
  name: string;

  @Prop({ type: Date, required: false })
  dateOfBirth?: Date;

  @Prop({ type: String, required: false, maxlength: 200 })
  address?: string;

  @Prop({ type: String, required: true, maxlength: 12 })
  identityId: string;

  @Prop({ type: String, required: false })
  @Exclude()
  refreshToken?: string;

  @Prop({ type: String, required: false })
  avatar?: string;

  @Prop({ type: Boolean, default: false })
  emailVerified: boolean;

  @Prop({ type: String, required: false })
  emailVerificationToken?: string;

  @Prop({ type: Date, required: false })
  emailVerificationExpires?: Date;

  @Prop({ type: String, required: false })
  googleId?: string;

  @Prop({ type: String, enum: ['local', 'google'], default: 'local' })
  provider: string;

  @Prop({ type: String, required: false })
  resetPasswordToken?: string;

  @Prop({ type: Date, required: false })
  resetPasswordExpires?: Date;

  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
