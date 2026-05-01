import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionPayload } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionPayload => {
    const request = context.switchToHttp().getRequest();
    return request.user as SessionPayload;
  },
);
