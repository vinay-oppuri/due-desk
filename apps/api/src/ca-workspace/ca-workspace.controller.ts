import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  CaWorkspaceService,
  type UpdateFirmDto,
} from './ca-workspace.service.js';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import type { BoardQueryDto } from './services/ca-board.service.js';
import type { ValidatedClient } from './services/ca-import.service.js';

@Controller('api/ca')
export class CaWorkspaceController {
  constructor(private readonly caService: CaWorkspaceService) {}

  @Get('firm')
  @UseGuards(SessionGuard)
  async getFirm(@Req() req: AuthenticatedRequest) {
    return this.caService.getFirmDetails(req.organizationId!);
  }

  @Patch('firm')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'ca')
  async updateFirm(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateFirmDto,
  ) {
    return this.caService.updateFirm(req.organizationId!, body);
  }

  @Get('staff')
  @UseGuards(SessionGuard)
  async getStaff(@Req() req: AuthenticatedRequest) {
    return this.caService.getStaffMembers(req.organizationId!);
  }

  @Post('clients/import/preview')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'ca', 'accountant')
  async previewImport(
    @Req() req: AuthenticatedRequest,
    @Body() body: { csvContent?: string; rows?: any[] },
  ) {
    const payload = body.csvContent ? body.csvContent : body.rows || [];
    return this.caService.previewCsvImport(req.organizationId!, payload);
  }

  @Post('clients/import/confirm')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'ca', 'accountant')
  async confirmImport(
    @Req() req: AuthenticatedRequest,
    @Body() body: { clients: ValidatedClient[] },
  ) {
    if (!body.clients || !Array.isArray(body.clients)) {
      throw new BadRequestException('A list of validated clients is required.');
    }
    return this.caService.confirmCsvImport(req.organizationId!, body.clients);
  }

  @Get('board')
  @UseGuards(SessionGuard)
  async getBoard(
    @Req() req: AuthenticatedRequest,
    @Query() query: BoardQueryDto,
  ) {
    return this.caService.getBoard(req.organizationId!, query);
  }

  @Patch('obligations/:id/assign')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'ca', 'accountant')
  async assignObligation(
    @Req() req: AuthenticatedRequest,
    @Param('id') obligationId: string,
    @Body('assigneeId') assigneeId: string | null,
  ) {
    return this.caService.assignObligation(
      req.organizationId!,
      obligationId,
      assigneeId,
    );
  }

  @Get('digest/preview')
  @UseGuards(SessionGuard)
  async getDigestPreview(@Req() req: AuthenticatedRequest) {
    return this.caService.getDigestPreview(req.organizationId!);
  }

  @Post('digest/send')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'ca')
  async sendDigest(
    @Req() req: AuthenticatedRequest,
    @Body('email') email?: string,
  ) {
    const recipientEmail = email || req.authSession?.user?.email;
    if (!recipientEmail) {
      throw new BadRequestException('Recipient email could not be determined.');
    }
    return this.caService.sendDigest(req.organizationId!, recipientEmail);
  }
}
