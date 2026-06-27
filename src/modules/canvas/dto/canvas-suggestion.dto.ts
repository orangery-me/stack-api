import { ApiProperty } from '@nestjs/swagger';
import {
  CanvasSuggestionAction,
  CanvasSuggestionStatus,
} from '@app/entities/canvas/canvas-suggestion.entity';

export class CanvasSuggestionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  canvasId: string;

  @ApiProperty()
  messageId: string;

  @ApiProperty({ required: false, nullable: true })
  actionId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  blockId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  targetBlockId?: string | null;

  @ApiProperty({ enum: ['replace_text', 'replace_block', 'insert_after', 'insert_before', 'delete_block'] })
  action: CanvasSuggestionAction;

  @ApiProperty({ type: Object })
  payload: Record<string, any>;

  @ApiProperty({ enum: ['pending', 'applying', 'accepted', 'rejected', 'failed'] })
  status: CanvasSuggestionStatus;

  @ApiProperty({ required: false, nullable: true })
  error?: string | null;

  @ApiProperty()
  createdBy: 'ai' | 'agent';

  @ApiProperty({ required: false, nullable: true })
  acceptedBy?: string | null;

  @ApiProperty({ required: false, nullable: true })
  rejectedBy?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CanvasSuggestionListDto {
  @ApiProperty({ type: [CanvasSuggestionDto] })
  suggestions: CanvasSuggestionDto[];
}
