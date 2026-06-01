import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CameraModule } from './camera/camera.module';
import { EggGateway } from './websocket/egg.gateway';

@Module({
  imports: [DatabaseModule, CameraModule],
  providers: [EggGateway],
})
export class AppModule {}