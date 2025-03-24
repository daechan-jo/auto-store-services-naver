import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { NaverUpdatedProductEntity } from './naverUpdatedProduct.entity';

@Entity('naver_updated_item')
export class NaverUpdatedOptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', name: 'option_id' })
  optionId: number;

  @Column({ type: 'varchar', length: 255, name: 'option_name' })
  optionName: string;

  // 기존 옵션가
  @Column({ type: 'int', name: 'option_price' })
  optionPrice: number;

  // 비교(경쟁) 옵션가
  @Column({ type: 'int', name: 'comparison_option_price' })
  comparisonOptionPrice: number;

  // 새로운 옵션가
  @Column({ type: 'int', name: 'new_option_price' })
  newOptionPrice: number;

  @ManyToOne(() => NaverUpdatedProductEntity, (product) => product.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'naver_updated_product_id' })
  product: Type<NaverUpdatedProductEntity>;
}
