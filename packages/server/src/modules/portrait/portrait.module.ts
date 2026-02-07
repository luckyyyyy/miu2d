import { Module } from "@nestjs/common";
import { PortraitRouter } from "./portrait.router";

@Module({
	providers: [PortraitRouter],
	exports: [PortraitRouter]
})
export class PortraitModule {}
