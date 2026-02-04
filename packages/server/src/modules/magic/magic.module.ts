import { Module } from "@nestjs/common";
import { MagicController } from "./magic.controller";
import { MagicRouter } from "./magic.router";

@Module({
	controllers: [MagicController],
	providers: [MagicRouter],
	exports: [MagicRouter]
})
export class MagicModule {}
