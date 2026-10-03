import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ExtensionRequestsService } from './extension-requests.service';
import { ApproveDto, ClarifyDto, DeclineDto, InterpretationDto } from './dto';

@Controller('api/extension-requests')
export class ExtensionRequestsController {
  constructor(private readonly service: ExtensionRequestsService) {}

  @Get()
  list(@Query('scope') scope?: string) {
    return this.service.listInbox(scope ?? 'DEMO');
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.service.approve(id, dto.optionType);
  }

  @Post(':id/offer')
  offer(@Param('id') id: string) {
    return this.service.offer(id);
  }

  @Post(':id/decline')
  decline(@Param('id') id: string, @Body() dto: DeclineDto) {
    return this.service.decline(id, dto.reason);
  }

  @Patch(':id/interpretation')
  setInterpretation(@Param('id') id: string, @Body() dto: InterpretationDto) {
    return this.service.setInterpretation(id, new Date(dto.requestedEndAt));
  }

  @Post(':id/clarify')
  clarify(@Param('id') id: string, @Body() dto: ClarifyDto) {
    return this.service.clarify(id, dto.body);
  }
}
