import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { NaverUpdatedOptionEntity } from './naverUpdatedOption.entity';

@Entity('naver_updated_product')
export class NaverUpdatedProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', name: 'origin_product_no' })
  originProductNo: number;

  @Column({ type: 'varchar', length: 255, name: 'product_name' })
  productName: string;

  @Column({ type: 'varchar', length: 255, name: 'seller_management_code', nullable: true })
  sellerManagementCode?: string;

  @Column({ name: 'onch_seller_price', type: 'int' })
  onchSellerPrice: number;

  @Column({ type: 'varchar', name: 'comparison_store' })
  comparisonStore: string;

  // 기존 상품가
  @Column({ type: 'int', name: 'sale_price' })
  salePrice: number;

  // 경쟁(비교) 상품가
  @Column({ type: 'int', name: 'comparison_price' })
  comparisonPrice: number;

  // 새로운 상품가
  @Column({ type: 'int', name: 'new_price' })
  newPrice: number;

  @Column({ type: 'varchar', length: 50, name: 'cron_id', nullable: false })
  cronId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // === 관계 설정: 1:N (상품 -> 옵션들)
  @OneToMany(() => NaverUpdatedOptionEntity, (item) => item.product, {
    cascade: true, // 상품 저장 시 옵션도 함께 저장 가능
    eager: true, // 상품 조회 시 옵션도 즉시 로딩(eager)할 지 여부
  })
  options: NaverUpdatedOptionEntity[];
}
