import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS (equivalent to Flask-CORS)
  app.enableCors();

  // Use native WS adapter for WebSocket gateway
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(5000);
  console.log('🥚 Egg Counter backend running on http://0.0.0.0:5000');
  console.log('🔌 WebSocket server on ws://0.0.0.0:5000/ws');
}
bootstrap();