import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { createContext } from "./trpc/context";
import { TrpcModule } from "./trpc/trpc.module";
import { AuthModule } from "./modules/auth";
import { FileModule } from "./modules/file";
import { GameModule } from "./modules/game";
import { GoodsModule } from "./modules/goods/goods.module";
import { LevelModule } from "./modules/level";
import { MagicModule } from "./modules/magic";
import { NpcModule } from "./modules/npc/npc.module";
import { UserModule } from "./modules/user";

@Module({
  imports: [
    TrpcModule.forRoot({
      createContext
    }),
    AuthModule,
    FileModule,
    GameModule,
    GoodsModule,
    LevelModule,
    MagicModule,
    NpcModule,
    UserModule
  ],
  controllers: [AppController]
})
export class AppModule {}
