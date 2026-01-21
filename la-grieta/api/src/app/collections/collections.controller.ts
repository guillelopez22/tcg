import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddCardToCollectionDto } from './dto/add-card.dto';
import { UpdateCollectionItemDto } from './dto/update-item.dto';

@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionsController {
  constructor(private collectionsService: CollectionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req) {
    return this.collectionsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.collectionsService.findOne(req.user.id, id);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto
  ) {
    return this.collectionsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req, @Param('id') id: string) {
    return this.collectionsService.remove(req.user.id, id);
  }

  @Post(':id/cards')
  @HttpCode(HttpStatus.CREATED)
  async addCard(
    @Request() req,
    @Param('id') collectionId: string,
    @Body() dto: AddCardToCollectionDto
  ) {
    return this.collectionsService.addCard(req.user.id, collectionId, dto);
  }

  @Put(':collectionId/cards/:itemId')
  async updateItem(
    @Request() req,
    @Param('collectionId') collectionId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCollectionItemDto
  ) {
    return this.collectionsService.updateItem(
      req.user.id,
      collectionId,
      itemId,
      dto
    );
  }

  @Delete(':collectionId/cards/:itemId')
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Request() req,
    @Param('collectionId') collectionId: string,
    @Param('itemId') itemId: string
  ) {
    return this.collectionsService.removeItem(req.user.id, collectionId, itemId);
  }

  @Get(':id/stats')
  async getStats(@Request() req, @Param('id') id: string) {
    return this.collectionsService.getStats(req.user.id, id);
  }

  @Post(':id/seed')
  @HttpCode(HttpStatus.OK)
  async seedCollection(@Request() req, @Param('id') id: string) {
    return this.collectionsService.seedCollection(req.user.id, id);
  }
}
