import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SignatureService {
  constructor(private readonly configService: ConfigService) {}

  generate(): { signature: string; timestamp: number } {
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const secret = this.configService.get<string>('NAVER_SECRET');

    const timestamp = Date.now();
    const password = `${clientId}_${timestamp}`;
    const hashed = bcrypt.hashSync(password, secret);
    const signature = Buffer.from(hashed, 'utf-8').toString('base64');

    return { signature, timestamp };
  }

  async getAccessToken(): Promise<string> {
    const { signature, timestamp } = this.generate();

    const requestBody = new URLSearchParams({
      client_id: this.configService.get<string>('NAVER_CLIENT_ID')!,
      timestamp: String(timestamp),
      client_secret_sign: signature,
      grant_type: 'client_credentials',
      type: 'SELF',
    });

    try {
      const response = await axios.post(
        `https://api.commerce.naver.com/external/v1/oauth2/token`,
        requestBody.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return response.data.access_token;
    } catch (error: any) {
      console.error(`액세스 토큰을 가져오지 못했습니다.`, error.response?.data || error.message);
      throw new Error('액세스 토큰을 가져올 수 없습니다.');
    }
  }
}
