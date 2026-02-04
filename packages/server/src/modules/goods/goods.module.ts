import { Module } from "@nestjs/common";
import { GoodsController } from "./goods.controller";
import { GoodsRouter } from "./goods.router";

@Module({
	controllers: [GoodsController],
	providers: [GoodsRouter],
	exports: [GoodsRouter]
})
export class GoodsModule {}
