import { Module } from "@nestjs/common";
import { DataController } from "./data.controller";

@Module({
	controllers: [DataController],
})
export class DataModule {}
