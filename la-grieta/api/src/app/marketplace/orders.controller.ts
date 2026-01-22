import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  OrderFiltersDto,
} from '@la-grieta/shared';

@Controller('marketplace/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, dto);
  }

  @Get()
  async findUserOrders(@Request() req, @Query() filters: OrderFiltersDto) {
    return this.ordersService.findUserOrders(req.user.id, filters);
  }

  @Get('sales')
  async findUserSales(@Request() req, @Query() filters: OrderFiltersDto) {
    return this.ordersService.findUserSales(req.user.id, filters);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.ordersService.findOne(req.user.id, id);
  }

  @Put(':id/status')
  async updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateStatus(req.user.id, id, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReceipt(@Request() req, @Param('id') id: string) {
    return this.ordersService.confirmReceipt(req.user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Request() req, @Param('id') id: string) {
    return this.ordersService.cancel(req.user.id, id);
  }
}
