import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PlaygroundService } from './playground.service';
import { CreatePlaygroundBookingDto, UpdatePlaygroundBookingDto } from './dto';

@Controller('api/playground')
export class PlaygroundController {
  constructor(private readonly service: PlaygroundService) {}

  @Post('reset')
  reset() {
    return this.service.reset();
  }

  @Get('bookings')
  listBookings() {
    return this.service.listBookings();
  }

  @Post('bookings')
  createBooking(@Body() dto: CreatePlaygroundBookingDto) {
    return this.service.createBooking(dto);
  }

  @Patch('bookings/:id')
  updateBooking(@Param('id') id: string, @Body() dto: UpdatePlaygroundBookingDto) {
    return this.service.updateBooking(id, dto);
  }

  @Delete('bookings/:id')
  cancelBooking(@Param('id') id: string) {
    return this.service.cancelBooking(id);
  }
}
