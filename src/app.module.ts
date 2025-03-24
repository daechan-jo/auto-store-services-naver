import { PlaywrightModule, PlaywrightService } from '@daechanjo/playwright';
import { RabbitMQModule } from '@daechanjo/rabbitmq';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Module, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { Queue } from 'bull';

import { NaverMessageController } from './api/naver.message.controller';
import { TypeormConfig } from './config/typeorm.config';
import { NaverApiService } from './core/naver.api.service';
import { NaverService } from './core/naver.service';
import { SignatureService } from './core/signature.service';
import { NaverProductEntity } from './infrastructure/entities/naverProduct.entity';
import { NaverProductOptionEntity } from './infrastructure/entities/naverProductOption.entity';
import { NaverUpdatedOptionEntity } from './infrastructure/entities/naverUpdatedOption.entity';
import { NaverUpdatedProductEntity } from './infrastructure/entities/naverUpdatedProduct.entity';
import { NaverRepository } from './infrastructure/repository/naver.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '/Users/daechanjo/codes/project/auto-store/.env',
    }),
    TypeOrmModule.forRootAsync(TypeormConfig),
    TypeOrmModule.forFeature([
      NaverProductEntity,
      NaverProductOptionEntity,
      NaverUpdatedProductEntity,
      NaverUpdatedOptionEntity,
    ]),
    BullModule.registerQueueAsync({
      name: 'naver-message-queue',
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
        prefix: '{bull}',
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 3,
          backoff: 30000,
        },
        limiter: {
          max: 1,
          duration: 1000,
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    RedisModule,
    PlaywrightModule,
    RabbitMQModule,
  ],
  controllers: [NaverMessageController],
  providers: [NaverService, NaverApiService, SignatureService, NaverRepository],
})
export class AppModule implements OnApplicationBootstrap, OnModuleInit {
  constructor(
    @InjectQueue('naver-message-queue') private readonly queue: Queue,
    private readonly playwrightService: PlaywrightService,
  ) {}

  async onApplicationBootstrap() {
    setTimeout(async () => {
      await this.playwrightService.init(true, 'chromium');
    });
  }

  async onModuleInit() {
    await this.queue.clean(0, 'delayed'); // 지연된 작업 제거
    await this.queue.clean(0, 'wait'); // 대기 중인 작업 제거
    await this.queue.clean(0, 'active'); // 활성 작업 제거
    await this.queue.empty(); // 모든 대기 중인 작업 제거 (옵션)
    console.log('Bull 대기열 초기화');
  }
}
