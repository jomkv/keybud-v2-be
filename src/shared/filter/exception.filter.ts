import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import ENV_VARIABLES from '../env-variables';

@Catch(HttpException)
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: ENV_VARIABLES.isProd ? 'Unknown error' : exception.message,
      path: request.url,
      stack: ENV_VARIABLES.isProd ? null : exception.stack,
    });
  }
}
