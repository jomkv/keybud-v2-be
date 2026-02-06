import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetSuggestedDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
