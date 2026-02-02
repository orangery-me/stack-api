import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class SaveCanvasContentDto {
  @ApiProperty({
    description: 'Nội dung canvas dạng block-based JSON',
    type: 'object',
    example: {
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'paragraph',
          props: { text: 'Hello world' },
          children: [],
        },
      ],
    },
  })
  @IsNotEmpty({ message: 'Content không được để trống' })
  content: any;
}

