import { CronType, RabbitmqMessage } from '@daechanjo/models';
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
    console.log(`${payload.type}${payload.cronId}: 📥${pattern}`);

    switch (pattern) {
      case 'postSearchProducts':
        const allChannelProducts = await this.naverApiService.postSearchProducts(
          payload.cronId,
          payload.type,
        );
        return { status: 'success', data: allChannelProducts };

      case 'deleteNaverOriginProducts':
        await this.naverApiService.deleteNaverOriginProducts(
          payload.cronId,
          payload.store,
          payload.type,
          payload.matchedNaverProducts,
        );
        break;

      case 'saveOriginalProductOptions':
        await this.naverService.saveOriginalProductOptions(
          payload.cronId,
          payload.type,
          payload.store,
          payload.originProductNos,
        );
        return { status: 'success' };

      case 'setNewPrice':
        await this.naverService.setNewPrice(payload.cronId, payload.type, payload.store);
        return { status: 'success' };

      case 'clearNaverProducts':
        await this.naverService.clearNaverProducts(payload.cronId, payload.type);
        return { status: 'success' };

      default:
        console.error();
        console.error(
          `${CronType.ERROR}${payload.type}${payload.cronId}: 📬알 수 없는 패턴 유형 ${pattern}`,
        );
        return { status: 'error', message: `알 수 없는 패턴 유형: ${pattern}` };
    }
  }
}
