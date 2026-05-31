import { Controller, Post, Body } from '@nestjs/common';
import { OrdersService } from '../orders.service';

@Controller('orders/webhook')
export class StripeWebhookController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async handleWebhook(@Body() payload: any) {
    return this.ordersService.handleStripeWebhook(payload);
  }
}
