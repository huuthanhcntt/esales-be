import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { NOTIFICATIONS_SERVICE } from '@app/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentsCreateChargeDto } from './dto/payments-create-charge.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stub: boolean;
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: ClientProxy,
  ) {
    this.stub = this.configService.get('STRIPE_STUB') === 'true';

    if (this.stub) {
      this.logger.log('Stripe STUB mode enabled — no real charges');
    } else {
      this.stripe = new Stripe(
        this.configService.get('STRIPE_SECRET_KEY'),
        { apiVersion: '2026-01-28.clover' },
      );
    }
  }

  async createCharge({ card, amount, email }: PaymentsCreateChargeDto) {
    let result: any;

    if (this.stub) {
      result = {
        id: `pi_stub_${randomUUID()}`,
        amount: amount * 100,
        currency: 'usd',
        status: 'succeeded',
        payment_method: `pm_stub_${randomUUID()}`,
      };
      this.logger.log(`Stub charge: $${amount} for ${email}`);
    } else {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card,
      });

      result = await this.stripe.paymentIntents.create({
        payment_method: paymentMethod.id,
        amount: amount * 100,
        confirm: true,
        payment_method_types: ['card'],
        currency: 'usd',
      });
    }

    this.notificationsService.emit('notify_email', {
      email,
      text: `Your payment of $${amount} has completed successfully.`,
    });

    return result;
  }
}
