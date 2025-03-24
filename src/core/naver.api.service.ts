import { CronType } from '@daechanjo/models';
import { RabbitMQService } from '@daechanjo/rabbitmq';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import moment from 'moment-timezone';

import { SignatureService } from './signature.service';

@Injectable()
export class NaverApiService {
  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly signatureService: SignatureService,
  ) {}

  async postSearchProducts(cronId: string, store: string, type: string) {
    const accessToken = await this.signatureService.getAccessToken();
    const today = moment().format('YYYY-MM-DD');
    const initday = '2024-10-01';
    const allChannelProducts: any[] = [];
    let currentPage = 1;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      while (true) {
        console.log(`${type}${cronId}: 페이지 ${currentPage} 데이터를 가져옵니다...`);

        const requestBody = {
          sellerManagementCode: '',
          productStatusTypes: ['SALE'], // 원하는 상품 상태
          page: currentPage,
          size: 500,
          orderType: 'NO',
          periodType: 'PROD_REG_DAY',
          fromDate: initday,
          toDate: today,
        };

        const response = await axios.post(
          'https://api.commerce.naver.com/external/v1/products/search',
          requestBody,
          { headers },
        );

        const { contents, totalPages } = response.data;

        // 현재 페이지의 channelProducts 배열에서 데이터를 수집
        contents.forEach((content: { channelProducts: any }) => {
          if (content.channelProducts && Array.isArray(content.channelProducts)) {
            allChannelProducts.push(...content.channelProducts);
          }
        });

        // 다음 페이지로 이동. 마지막 페이지면 루프 종료
        if (currentPage >= totalPages) {
          console.log(`${type}${cronId}: 모든 페이지 데이터를 수집했습니다.`);
          break;
        }

        currentPage++; // 다음 페이지로 이동
      }

      return allChannelProducts;
    } catch (error: any) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: API 요청 오류:`,
        error.response?.data || error.message,
      );

      throw new Error('네이버 API 요청 실패');
    }
  }

  async deleteNaverOriginProducts(
    cronId: string,
    store: string,
    type: string,
    matchedNaverProducts: any[],
  ) {
    const deletedProducts = [];

    const accessToken = await this.signatureService.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    for (const product of matchedNaverProducts) {
      try {
        await axios.delete(
          `https://api.commerce.naver.com/external/v2/products/origin-products/${product.originProductNo}`,
          { headers },
        );
        console.log(
          `${type}${cronId}: 네이버 상품 삭제 성공 originProductNo-${product.originProductNo}`,
        );

        deletedProducts.push({
          originProductNo: product.originProductNo,
          productName: product?.name ? product.name : product.productName,
        });
      } catch (error: any) {
        console.error(
          `${CronType.ERROR}${type}${cronId}: 네이버 상품 삭제 실패 originProductNo-${product.originProductNo})\n`,
          error.response?.data || error.message,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (deletedProducts.length > 0) {
      try {
        await this.rabbitmqService.emit('mail-queue', 'sendBatchDeletionEmail', {
          deletedProducts: deletedProducts,
          type: type,
          store: store,
          platformName: 'naver',
        });
      } catch (error: any) {
        console.error(
          `${CronType.ERROR}${type}${cronId}: 삭제 알림 이메일 발송 실패\n`,
          error.message,
        );
      }
    }
  }

  async getOriginalProduct(cronId: string, type: string, store: string, originProductNo: number) {
    const accessToken = await this.signatureService.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.get(
        `https://api.commerce.naver.com/external/v2/products/origin-products/${originProductNo}`,
        { headers },
      );

      return response.data;
    } catch (error: any) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: 원상품 조회 실패 ${originProductNo}\n`,
        error.message,
      );
    }
  }
  async modifyNaverOriginalProduct(cronId: string, store: string, type: string, product: any) {
    const accessToken = await this.signatureService.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      // 1. 기존 상품 정보 가져오기
      const response = await this.getOriginalProduct(cronId, type, store, product.originProductNo);
      const originProduct = response.originProduct;

      // 2. 상품 가격 업데이트
      originProduct.salePrice = product.newPrice;

      // 3. 옵션 가격 업데이트
      if (originProduct.detailAttribute?.optionInfo?.optionCombinations) {
        originProduct.detailAttribute.optionInfo.optionCombinations =
          originProduct.detailAttribute.optionInfo.optionCombinations.map((originalOption: any) => {
            const matchingUpdatedOption = product.options.find(
              (opt: any) => opt.optionId === originalOption.id,
            );

            if (matchingUpdatedOption) {
              originalOption.price = matchingUpdatedOption.newOptionPrice;
            }

            return originalOption;
          });
      }

      await axios.put(
        `https://api.commerce.naver.com/external/v2/products/origin-products/${product.originProductNo}`,
        { originProduct },
        { headers },
      );
    } catch (error: any) {
      console.error(`${CronType.ERROR}${type}${cronId}`, error.response.data);
    }
  }
}
