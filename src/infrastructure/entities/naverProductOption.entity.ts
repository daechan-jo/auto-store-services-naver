import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { NaverProductEntity } from './naverProduct.entity';

@Entity('naver_product_option')
export class NaverProductOptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'option_id', type: 'bigint' })
  optionId: number;

  @Column({ name: 'option_name', type: 'varchar', length: 255, nullable: true })
  optionName: string; // 옵션 이름

  @Column({ name: 'stock_quantity', type: 'int', nullable: true })
  stockQuantity: number; // 옵션 재고 수량

  @Column({ name: 'option_price', type: 'int', nullable: true })
  optionPrice: number; // 옵션 가격

  @Column({ name: 'usable', type: 'boolean', default: true })
  usable: boolean; // 옵션 사용 가능 여부

  // NaverProduct와의 관계 설정
  @ManyToOne(() => NaverProductEntity, (product) => product.options, { onDelete: 'CASCADE' })
  product: Type<NaverProductEntity>;
}
