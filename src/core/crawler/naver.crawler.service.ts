import { RabbitMQService } from '@daechanjo/rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SignatureService } from '../signature.service';

@Injectable()
export class NaverCrawlerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly signatureService: SignatureService,
  ) {}
}
