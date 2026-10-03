export interface CreatePlaygroundBookingDto {
  vehicleId: string;
  renterName: string | null;
  source: 'DIRECT' | 'TURO';
  startAt: string;
  endAt: string;
  hasCover: boolean;
}

export interface UpdatePlaygroundBookingDto {
  vehicleId: string;
  renterName: string | null;
  source: 'DIRECT' | 'TURO';
  startAt: string;
  endAt: string;
  hasCover: boolean;
}
