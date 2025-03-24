import { Type } from '@daechanjo/models';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

import { NaverProductOptionEntity } from './naverProductOption.entity';

@Entity('naver_product')
export class NaverProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'origin_product_no', type: 'bigint', nullable: false })
  originProductNo: number;

  @Column({ name: 'seller_management_code', type: 'varchar', length: 255, nullable: false })
  sellerManagementCode: string;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: false })
  productName: string;

  @Column({ name: 'sale_price', type: 'int', nullable: false })
  salePrice: number;

  @Column({ name: 'cron_id', type: 'varchar', nullable: false })
  cronId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => NaverProductOptionEntity, (option) => option.product, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  options: Type<NaverProductOptionEntity>[];
}
