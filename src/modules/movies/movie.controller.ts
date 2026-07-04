import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { API_TAGS } from '@common/swagger';

@ApiTags(API_TAGS.MOVIES)
@Controller('movies')
export class MovieController {}
