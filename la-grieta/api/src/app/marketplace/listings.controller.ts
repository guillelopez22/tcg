import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateListingDto,
  UpdateListingDto,
  ListingFiltersDto,
} from '@la-grieta/shared';

@Controller('marketplace/listings')
export class ListingsController {
  constructor(private listingsService: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateListingDto) {
    return this.listingsService.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Query() filters: ListingFiltersDto) {
    return this.listingsService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto
  ) {
    return this.listingsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req, @Param('id') id: string) {
    return this.listingsService.remove(req.user.id, id);
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async purchase(@Request() req, @Param('id') id: string) {
    return this.listingsService.purchase(req.user.id, id);
  }
}
