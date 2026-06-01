import { Module, forwardRef } from '@nestjs/common';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';
import { DatabaseModule } from '../database/database.module';
import { InferenceClient } from '../inference/inference.client';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => WebsocketModule)],
  providers: [CameraService, InferenceClient],
  controllers: [CameraController],
  exports: [CameraService],
})
export class CameraModule {}