import { Module, forwardRef } from '@nestjs/common';
import { EggGateway } from './egg.gateway';
import { CameraModule } from '../camera/camera.module';

@Module({
  imports: [forwardRef(() => CameraModule)],
  providers: [EggGateway],
  exports: [EggGateway],
})
export class WebsocketModule {}