import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsString, ValidateNested } from 'class-validator';

export class NodeDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsNumber()
  positionX: number;

  @IsNumber()
  positionY: number;

  @IsObject()
  data: any;
}

export class EdgeDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;

  @IsString()
  label?: string;
}

export class FlowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];
}
