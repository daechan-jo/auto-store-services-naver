import * as process from 'node:process';

import { setupGlobalConsoleLogging } from '@daechanjo/log';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { initializeTransactionalContext } from 'typeorm-transactional';

import { AppModule } from './app.module';

dotenv.config({
  path: '/Users/daechanjo/codes/project/auto-store/.env',
});

async function bootstrap() {
  initializeTransactionalContext();
  setupGlobalConsoleLogging();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [String(process.env.RABBITMQ_URL)],
      queue: 'naver-queue',
      queueOptions: { durable: false },
    },
  });

  await app.listen();
  console.log('네이버 서비스 시작');
}

bootstrap();
