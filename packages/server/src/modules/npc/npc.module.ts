import { Module } from "@nestjs/common";
import { NpcController } from "./npc.controller";
import { NpcRouter } from "./npc.router";

@Module({
	controllers: [NpcController],
	providers: [NpcRouter],
	exports: [NpcRouter]
})
export class NpcModule {}
