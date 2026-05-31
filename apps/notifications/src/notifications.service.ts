import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NotifyEmailDto } from './dto/notify-email.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');

    if (smtpHost) {
      // Local development: plain SMTP (Mailpit, MailHog, etc.)
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.configService.get<number>('SMTP_PORT') || 1025,
        secure: false,
      });
      this.logger.log(`Using SMTP transport: ${smtpHost}`);
    } else {
      // Production: Gmail OAuth2
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.configService.get('SMTP_USER'),
          clientId: this.configService.get('GOOGLE_OAUTH_CLIENT_ID'),
          clientSecret: this.configService.get('GOOGLE_OAUTH_CLIENT_SECRET'),
          refreshToken: this.configService.get('GOOGLE_OAUTH_REFRESH_TOKEN'),
        },
      });
      this.logger.log('Using Gmail OAuth2 transport');
    }
  }

  async notifyEmail({ email, text }: NotifyEmailDto) {
    await this.transporter.sendMail({
      from: this.configService.get('SMTP_USER') || 'noreply@esales.local',
      to: email,
      subject: 'eSales Notification',
      text,
    });
  }
}
