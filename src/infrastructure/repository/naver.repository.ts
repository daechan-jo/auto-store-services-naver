import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { NaverProductEntity } from '../entities/naverProduct.entity';
import { NaverProductOptionEntity } from '../entities/naverProductOption.entity';
import { NaverUpdatedProductEntity } from '../entities/naverUpdatedProduct.entity';

export class NaverRepository {
  constructor(
    @InjectRepository(NaverProductEntity)
    private readonly naverProductRepository: Repository<NaverProductEntity>,
    @InjectRepository(NaverProductOptionEntity)
    private readonly naverProductOptionRepository: Repository<NaverProductOptionEntity>,
    @InjectRepository(NaverUpdatedProductEntity)
    private readonly naverUpdatedProductRepository: Repository<NaverUpdatedProductEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // async findNaverProducts() {
  //   return this.naverRepository.find({});
  // }
  async saveNaverProducts(products: Partial<NaverProductEntity>[]) {
    for (const product of products) {
      const naverProduct = this.naverProductRepository.create({
        ...product,
        options: product.options.map((option) => this.naverProductOptionRepository.create(option)),
      });
      await this.naverProductRepository.save(naverProduct);
    }
  }

  async getUpdatedProduct(cronId: string) {
    return await this.naverUpdatedProductRepository.find({ where: { cronId: cronId } });
  }

  async clearNaverProducts() {
    await this.naverProductOptionRepository.delete({});
    await this.naverProductRepository.delete({});
  }
}
