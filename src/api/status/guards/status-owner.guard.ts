import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestService } from 'src/request/request.service';

@Injectable()
export class StatusOwnerGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestService: RequestService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = this.requestService.getUser();
    const statusId = Number(req.params.id);

    const status = await this.prismaService.status.findUnique({
      where: { id: statusId },
    });
    if (!status) throw new NotFoundException('Status not found');
    if (status.userId !== user.id) throw new UnauthorizedException('Not owner');

    // Attach to request to avoid re-querying
    req.status = status;
    return true;
  }
}
