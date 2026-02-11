import { Module } from "@nestjs/common";
import { SceneRouter } from "./scene.router";

@Module({
	providers: [SceneRouter],
	exports: [SceneRouter]
})
export class SceneModule {}
