import { CronType } from '@daechanjo/models';
import { NaverChannelProduct } from '@daechanjo/models/dist/interfaces/naver/naverChannelProduct.interface';
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

  /**
   * 네이버 쇼핑몰 상품 목록을 검색하고 모든 페이지의 데이터를 수집합니다.
   * 페이지네이션을 자동으로 처리하여 모든 상품 정보를 반환합니다.
   *
   * @param {string} cronId - 현재 실행 중인 크론 작업의 고유 식별자
   * @param {string} type - 크론 작업의 유형 (예: 'SOLDOUT', 'UPDATE' 등)
   * @returns {Promise<NaverChannelProduct[]>} 수집된 모든 네이버 채널 상품 객체의 배열
   * @throws {Error} 네이버 API 호출 중 오류가 발생할 경우 예외 발생
   *
   * @example
   * // 상품 목록 가져오기
   * const products = await postSearchProducts('cron-123', CronType.SOLDOUT);
   */
  async postSearchProducts(cronId: string, type: string): Promise<NaverChannelProduct[]> {
    const accessToken = await this.signatureService.getAccessToken();
    const today = moment().format('YYYY-MM-DD');
    const initday = '2024-10-01';
    const allChannelProducts: any[] = [];
    let currentPage = 1;
    let lastReportedProgress = 0;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      while (true) {
        console.log(`${type}${cronId}: 페이지 ${currentPage} 데이터를 가져옵니다...`);

        const { contents, totalPages } = await this.postSearchProduct(
          headers,
          currentPage,
          initday,
          today,
        );

        // 현재 페이지의 channelProducts 배열에서 데이터를 수집
        contents.forEach((content: { channelProducts: NaverChannelProduct[] }) => {
          if (content.channelProducts && Array.isArray(content.channelProducts)) {
            allChannelProducts.push(...content.channelProducts);
          }
        });

        const currentProgress = Math.floor((currentPage / totalPages) * 100);
        const roundedProgress = Math.floor(currentProgress / 10) * 10;
        if (roundedProgress > lastReportedProgress) {
          console.log(`${type}${cronId}: 데이터 수집 진행률: ${roundedProgress}%`);
          lastReportedProgress = roundedProgress;
        }

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

  /**
   * 네이버 쇼핑몰 API를 호출하여 특정 페이지의 상품 목록을 가져옵니다.
   * 상품 검색 API를 호출하고 응답 데이터를 반환합니다.
   *
   * @param {Object} headers - API 요청에 필요한 헤더 정보
   * headers.Authorization<string> - Bearer 토큰이 포함된 인증 헤더
   * headers['Content-Type'] - 요청 콘텐츠 타입 (항상 'application/json')
   * @param {number} currentPage - 조회할 페이지 번호 (1부터 시작)
   * @param {string} initday - 검색 시작 날짜 (YYYY-MM-DD 형식)
   * @param {string} today - 검색 종료 날짜 (YYYY-MM-DD 형식, 보통 현재 날짜)
   * @returns {Promise<{contents: Array<{channelProducts: NaverChannelProduct[]}>, totalPages: number}>}
   *          조회된 상품 데이터와, 전체 페이지 수를 포함하는 객체
   * @throws {Error} API 요청 실패 시 Axios에서 발생하는 예외를 그대로 전파
   *
   * @example
   * // 특정 페이지의 상품 데이터 가져오기
   * const { contents, totalPages } = await postSearchProduct(
   *   { Authorization: 'Bearer token123', 'Content-Type': 'application/json' },
   *   1,
   *   '2024-01-01',
   *   '2024-03-24'
   * );
   */
  private async postSearchProduct(
    headers: { Authorization: string; 'Content-Type': string },
    currentPage: number,
    initday: string,
    today: string,
  ): Promise<{ contents: Array<{ channelProducts: NaverChannelProduct[] }>; totalPages: number }> {
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
    return response.data;
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
