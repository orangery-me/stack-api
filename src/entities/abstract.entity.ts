import { Prop, Schema } from '@nestjs/mongoose';
import { Exclude, Transform } from 'class-transformer';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  versionKey: false,
})
export abstract class AbstractEntity extends Document {
  @Transform(({ value }) => value?.toString())
  _id: Types.ObjectId;

  @Transform(({ value }) => value?.toString())
  id: string;

  @Prop({ type: Date, default: Date.now })
  @Exclude()
  createdAt: Date;

  @Prop({ type: String, required: false })
  @Exclude()
  createdBy?: string;

  @Prop({ type: Date, default: Date.now })
  @Exclude()
  updatedAt: Date;

  @Prop({ type: String, required: false })
  @Exclude()
  updatedBy?: string;

  @Prop({ type: Date, required: false })
  @Exclude()
  deletedAt?: Date;

  @Prop({ type: String, required: false })
  @Exclude()
  deletedBy?: string;
}
