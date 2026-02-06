import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { createContext } from "./trpc/context";
import { TrpcModule } from "./trpc/trpc.module";
import { AuthModule } from "./modules/auth";
import { DataModule } from "./modules/data";
import { FileModule } from "./modules/file";
import { GameModule } from "./modules/game";
import { GameConfigModule } from "./modules/gameConfig";
import { GoodsModule } from "./modules/goods/goods.module";
import { LevelModule } from "./modules/level";
import { MagicModule } from "./modules/magic";
import { NpcModule } from "./modules/npc/npc.module";
import { ObjModule } from "./modules/obj/obj.module";
import { ShopModule } from "./modules/shop/shop.module";
import { UserModule } from "./modules/user";

@Module({
  imports: [
    TrpcModule.forRoot({
      createContext
    }),
    AuthModule,
    DataModule,
    FileModule,
    GameModule,
    GameConfigModule,
    GoodsModule,
    LevelModule,
    MagicModule,
    NpcModule,
    ObjModule,
    ShopModule,
    UserModule
  ],
  controllers: [AppController]
})
export class AppModule {}
