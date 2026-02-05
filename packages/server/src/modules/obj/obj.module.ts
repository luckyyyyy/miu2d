import { Module } from "@nestjs/common";
import { ObjController } from "./obj.controller";
import { ObjRouter } from "./obj.router";

@Module({
	controllers: [ObjController],
	providers: [ObjRouter],
	exports: [ObjRouter]
})
export class ObjModule {}
