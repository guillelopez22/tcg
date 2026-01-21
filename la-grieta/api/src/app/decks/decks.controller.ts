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
import { DecksService } from './decks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { AddCardToDeckDto } from './dto/add-card.dto';
import { UpdateDeckCardDto } from './dto/update-deck-card.dto';

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(private decksService: DecksService) {}

  /**
   * POST /api/decks
   * Create a new deck
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateDeckDto) {
    return this.decksService.create(req.user.id, dto);
  }

  /**
   * GET /api/decks
   * Get all decks for the authenticated user
   */
  @Get()
  async findAll(@Request() req) {
    return this.decksService.findAll(req.user.id);
  }

  /**
   * GET /api/decks/:id
   * Get a specific deck with all its cards
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.decksService.findOne(req.user.id, id);
  }

  /**
   * PUT /api/decks/:id
   * Update deck metadata (name, description, isPublic)
   */
  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto
  ) {
    return this.decksService.update(req.user.id, id, dto);
  }

  /**
   * DELETE /api/decks/:id
   * Delete a deck
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req, @Param('id') id: string) {
    return this.decksService.remove(req.user.id, id);
  }

  /**
   * POST /api/decks/:id/cards
   * Add a card to a deck
   */
  @Post(':id/cards')
  @HttpCode(HttpStatus.CREATED)
  async addCard(
    @Request() req,
    @Param('id') deckId: string,
    @Body() dto: AddCardToDeckDto
  ) {
    return this.decksService.addCard(req.user.id, deckId, dto);
  }

  /**
   * PUT /api/decks/:id/cards/:cardId
   * Update a card in a deck (quantity or zone)
   */
  @Put(':id/cards/:cardId')
  async updateCard(
    @Request() req,
    @Param('id') deckId: string,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateDeckCardDto
  ) {
    return this.decksService.updateCard(req.user.id, deckId, cardId, dto);
  }

  /**
   * DELETE /api/decks/:id/cards/:cardId
   * Remove a card from a deck
   */
  @Delete(':id/cards/:cardId')
  @HttpCode(HttpStatus.OK)
  async removeCard(
    @Request() req,
    @Param('id') deckId: string,
    @Param('cardId') cardId: string
  ) {
    return this.decksService.removeCard(req.user.id, deckId, cardId);
  }

  /**
   * POST /api/decks/:id/validate
   * Validate a deck against Riftbound rules
   */
  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Request() req, @Param('id') id: string) {
    return this.decksService.validateDeck(req.user.id, id);
  }

  /**
   * GET /api/decks/:id/stats
   * Get deck statistics
   */
  @Get(':id/stats')
  async getStats(@Request() req, @Param('id') id: string) {
    return this.decksService.getStats(req.user.id, id);
  }
}
