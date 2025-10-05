import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { AllExceptionFilter } from './shared/filter/exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Globals
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionFilter());

  await app.listen(4040);
}
bootstrap();
