import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { InboundMessageDto } from './dto';

@Controller('api/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(@Query('renterId') renterId: string) {
    return this.messagesService.listForRenter(renterId);
  }

  @Post('inbound')
  inbound(@Body() body: InboundMessageDto) {
    return this.messagesService.receiveInbound(body);
  }
}
