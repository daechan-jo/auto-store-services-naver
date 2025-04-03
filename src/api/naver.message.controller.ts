import { JobType, RabbitmqMessage } from '@daechanjo/models';
import { InjectQueue } from '@nestjs/bull';
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { Queue } from 'bull';

import { NaverApiService } from '../core/naver.api.service';
import { NaverService } from '../core/naver.service';

@Controller()
export class NaverMessageController {
  constructor(
    private readonly naverApiService: NaverApiService,
    private readonly naverService: NaverService,
    @InjectQueue('naver-message-queue') private readonly messageQueue: Queue,
  ) {}

  @MessagePattern('naver-queue')
  async processMessage(message: RabbitmqMessage) {
    const { pattern, payload } = message;
    console.log(`${payload.jobType}${payload.jobId}: 📥${pattern}`);

    switch (pattern) {
      case 'postSearchProducts':
        const allChannelProducts = await this.naverApiService.postSearchProducts(
          payload.jobId,
          payload.jobType,
        );
        return { status: 'success', data: allChannelProducts };

      case 'deleteNaverOriginProducts':
        await this.naverApiService.deleteNaverOriginProducts(
          payload.jobId,
          payload.jobType,
          payload.store,
          payload.data,
        );
        break;

      case 'saveOriginalProductOptions':
        await this.naverService.saveOriginalProductOptions(
          payload.jobId,
          payload.jobType,
          payload.store,
          payload.data,
        );
        return { status: 'success' };

      case 'setNewPrice':
        await this.naverService.setNewPrice(payload.jobId, payload.jobType, payload.store);
        return { status: 'success' };

      case 'clearNaverProducts':
        await this.naverService.clearNaverProducts(payload.jobId, payload.jobType);
        return { status: 'success' };

      default:
        console.error();
        console.error(
          `${JobType.ERROR}${payload.jobType}${payload.jobId}: 📬알 수 없는 패턴 유형 ${pattern}`,
        );
        return { status: 'error', message: `알 수 없는 패턴 유형: ${pattern}` };
    }
  }
}
