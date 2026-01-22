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
import { ShopsService } from './shops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateShopDto, UpdateShopDto } from '@la-grieta/shared';

@Controller('marketplace/shops')
export class ShopsController {
  constructor(private shopsService: ShopsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateShopDto) {
    return this.shopsService.create(req.user.id, dto);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.shopsService.findAll(page, limit);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyShop(@Request() req) {
    return this.shopsService.getMyShop(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.shopsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateShopDto
  ) {
    return this.shopsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async delete(@Request() req, @Param('id') id: string) {
    return this.shopsService.delete(req.user.id, id);
  }
}
