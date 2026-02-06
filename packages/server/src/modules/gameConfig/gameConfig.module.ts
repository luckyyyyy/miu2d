import { Module } from "@nestjs/common";
import { GameConfigRouter } from "./gameConfig.router";

@Module({
	providers: [GameConfigRouter],
	exports: [GameConfigRouter]
})
export class GameConfigModule {}
