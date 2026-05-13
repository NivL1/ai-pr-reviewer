import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Validates GitHub's `X-Hub-Signature-256` header against the raw request body
 * using the configured webhook secret. Uses a timing-safe comparison.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody: string | undefined = req.rawBody;

    if (!signature || !rawBody) {
      throw new UnauthorizedException('Missing webhook signature or body');
    }

    const secret = this.config.get<string>('github.webhookSecret', { infer: true });
    if (!secret) {
      this.logger.error('GITHUB_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
