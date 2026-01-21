import { Controller, Get, Query, Param, Post, UseGuards } from '@nestjs/common';
import { CardsService, CardFilters } from './cards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cards')
export class CardsController {
  constructor(private cardsService: CardsService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('cardType') cardType?: string,
    @Query('domains') domains?: string | string[],
    @Query('region') region?: string,
    @Query('rarity') rarity?: string,
    @Query('setCode') setCode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: CardFilters = {
      search,
      cardType,
      domains: domains ? (Array.isArray(domains) ? domains : [domains]) : undefined,
      region,
      rarity,
      setCode,
    };

    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 24;

    return this.cardsService.findAll(filters, pageNum, limitNum);
  }

  @Get('sets')
  async getSets() {
    return this.cardsService.getSets();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cardsService.findOne(id);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async syncCards() {
    return this.cardsService.syncCards();
  }
}
