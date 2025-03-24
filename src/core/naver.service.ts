import path from 'path';

import { CronType } from '@daechanjo/models';
import { RabbitMQService } from '@daechanjo/rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as XLSX from 'xlsx';

import { NaverApiService } from './naver.api.service';
import { NaverRepository } from '../infrastructure/repository/naver.repository';

@Injectable()
export class NaverService {
  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly naverRepository: NaverRepository,
    private readonly naverApiService: NaverApiService,
  ) {}

  async saveOriginalProductOptions(
    cronId: string,
    type: string,
    store: string,
    originProductNos: number[],
  ) {
    const BATCH_SIZE = 10; // API 호출 배치 크기
    const SAVE_BATCH_SIZE = 100; // 데이터 저장 배치 크기
    const DELAY_MS = 500; // API 호출 간 딜레이

    let totalProcessed = 0;
    let totalFailed = 0;
    const batchedProducts: any[] = [];

    console.log(`${type}${cronId}: ${originProductNos.length}개의 네이버 상품 옵션 조회 시작.`);

    for (let i = 0; i < originProductNos.length; i += BATCH_SIZE) {
      const batch = originProductNos.slice(i, i + BATCH_SIZE);

      console.log(
        `${type}${cronId}: 배치 ${Math.ceil(i / BATCH_SIZE) + 1} 처리 시작 (${batch.length}개 상품 조회 중)...`,
      );

      // 개별 상품 데이터 처리
      for (const originProductNo of batch) {
        try {
          const response = await this.naverApiService.getOriginalProduct(
            cronId,
            type,
            store,
            originProductNo,
          );

          if (response.originProduct) {
            const baseProduct = {
              originProductNo: originProductNo,
              sellerManagementCode:
                response.originProduct.detailAttribute.sellerCodeInfo.sellerManagementCode,
              productName: response.originProduct.name,
              salePrice: response.originProduct.salePrice,
              createdAt: new Date(),
              options: [], // 옵션 정보를 저장할 배열
              cronId: cronId,
            };

            const optionCombinations =
              response.originProduct.detailAttribute.optionInfo.optionCombinations || [];
            if (optionCombinations.length > 0) {
              baseProduct.options = optionCombinations.map((option: any) => ({
                optionId: option.id,
                optionName: option.optionName1,
                stockQuantity: option.stockQuantity,
                optionPrice: option.price,
                usable: option.usable,
              }));
            }

            batchedProducts.push(baseProduct);
          }
        } catch (error: any) {
          console.error(
            `${type}${cronId}: 원상품 조회 실패 (상품번호: ${originProductNo})\n`,
            error.message,
          );
          totalFailed++;
        }

        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }

      totalProcessed += batch.length;

      // 저장 배치 크기 이상일 경우 저장
      if (batchedProducts.length >= SAVE_BATCH_SIZE) {
        console.log(
          `${type}${cronId}: 중간 저장 시작 (${batchedProducts.length}개 상품 저장 중)...`,
        );
        await this.saveNaverProducts(type, cronId, batchedProducts.splice(0, SAVE_BATCH_SIZE));
        console.log(`${type}${cronId}: 중간 저장 완료.`);
      }
    }

    // 남아 있는 데이터 저장
    if (batchedProducts.length > 0) {
      console.log(`${type}${cronId}: 최종 저장 시작 (${batchedProducts.length}개 상품 저장 중)...`);
      await this.saveNaverProducts(type, cronId, batchedProducts);
      console.log(`${type}${cronId}: 최종 저장 완료.`);
    }

    console.log(
      `${type}${cronId}: 네이버 상품 옵션 조회 및 저장 완료. 총 처리 상품: ${totalProcessed}, 실패: ${totalFailed}`,
    );
  }

  async saveNaverProducts(type: string, cronId: string, products: any[]) {
    try {
      await this.naverRepository.saveNaverProducts(products);
    } catch (error: any) {
      console.error(`${CronType.ERROR}${type}${cronId}: 상품 저장 실패\n`, error.message);
      throw error;
    }
  }

  async setNewPrice(cronId: string, type: string, store: string) {
    console.log(`${type}${cronId}: 네이버 가격 API 시작`);
    let successCount = 0;
    let failedCount = 0;

    const updatedProduct = await this.naverRepository.getUpdatedProduct(cronId);

    for (const [i, product] of updatedProduct.entries()) {
      console.log(`${type}${cronId}: ${i + 1}/${updatedProduct.length}`);

      try {
        await this.naverApiService.modifyNaverOriginalProduct(cronId, store, type, product);

        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error: any) {
        failedCount++;
        console.error(
          `${CronType.ERROR}${type}${cronId}:`,
          JSON.stringify(product, null, 2),
          error.message,
        );
      }
    }

    console.log(`${type}${cronId}: 엑셀 생성 시작`);
    setImmediate(async () => {
      try {
        const excelData = updatedProduct.map((product: any) => ({
          originProductNo: product.originProductNo,
          productName: product.productName,
          sellerManagementCode: product.sellerManagementCode,
          onchSellerPrice: product.onchSellerPrice,
          salePrice: product.salePrice,
          comparisonPrice: product.comparisonPrice,
          newPrice: product.newPrice,
          cronId: product.cronId,
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        const formattedDate = new Date()
          .toISOString()
          .slice(2, 10) // ISO 포맷의 앞부분(YY-MM-DD) 추출
          .replace(/-/g, ''); // '-' 제거
        XLSX.utils.book_append_sheet(workbook, worksheet, `naver-${store}-${formattedDate}`);

        const filePath = path.resolve(__dirname, '../../../../../tmp', `naver_${cronId}.xlsx`);

        XLSX.writeFile(workbook, filePath);

        console.log(`${type}${cronId}: 엑셀 파일 전송 요청`);
        await this.rabbitmqService.emit('mail-queue', 'sendUpdateEmail', {
          filePath: filePath,
          successCount: successCount,
          filedCount: failedCount,
          store: this.configService.get<string>('STORE'),
          smartStore: 'naver',
        });

        console.log(`${type}${cronId}: 엑셀 파일 전송 요청 완료`);
      } catch (error: any) {
        console.error(`${CronType.ERROR}${type}${cronId}: 메시지 전송 실패\n`, error.message);
      }
    });
    console.log(`${type}${cronId}: 상품 가격 업데이트 완료`);
  }

  async clearNaverProducts(cronId: string, type: string) {
    console.log(`${type}${cronId}: 네이버 데이터베이스 초기화`);
    await this.naverRepository.clearNaverProducts();
  }
}
