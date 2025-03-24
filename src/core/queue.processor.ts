import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';

@Processor('re-naver-message-queue') // 큐 이름
@Injectable()
export class MessageQueueProcessor {
  constructor() {}

  @Process('process-message') // 작업 이름
  async processMessage(job: Job) {
    //   const { pattern, payload } = job.data;
    //
    //   this.commonService.log(`🚀 ${payload.type}${payload.cronId}: ${pattern}`);
    //
    //   try {
    //     switch (pattern) {
    //       // case 'orderStatusUpdate':
    //       //   await this.naverService.orderStatusUpdate(payload.cronId);
    //       //   break;
    //       //
    //
    //       default:
    //         this.commonService.warn(
    //           `${CronType.ERROR}🪄${payload.type}${payload.cronId}: 알 수 없는 패턴 ${pattern}`,
    //         );
    //     }
    //   } catch (error: any) {
    //     this.commonService.error(
    //       `${CronType.ERROR} 🚀 ${payload.type}${payload.cronId}: ${pattern}\n`,
    //       error,
    //     );
    //   }
  }
}
