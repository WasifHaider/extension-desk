import type {
  Vehicle,
  RenterPickerEntry,
  Message,
  InboxRow,
  ExtensionRequestDetail,
  Meta,
  PlaygroundBooking,
} from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface BookingFormInput {
  vehicleId: string;
  renterName: string | null;
  source: 'DIRECT' | 'TURO';
  startAt: string;
  endAt: string;
  hasCover: boolean;
}

export const api = {
  meta: () => fetch('/api/meta').then((r) => json<Meta>(r)),
  vehicles: (scope?: string) =>
    fetch(`/api/vehicles${scope ? `?scope=${scope}` : ''}`).then((r) => json<Vehicle[]>(r)),
  renters: (scope?: string) =>
    fetch(`/api/renters${scope ? `?scope=${scope}` : ''}`).then((r) => json<RenterPickerEntry[]>(r)),
  messages: (renterId: string) => fetch(`/api/messages?renterId=${renterId}`).then((r) => json<Message[]>(r)),
  inbox: (scope?: string) =>
    fetch(`/api/extension-requests${scope ? `?scope=${scope}` : ''}`).then((r) => json<InboxRow[]>(r)),
  detail: (id: string) => fetch(`/api/extension-requests/${id}`).then((r) => json<ExtensionRequestDetail>(r)),

  sendInbound: (renterId: string, body: string) =>
    fetch('/api/messages/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renterId, body }),
    }).then((r) => json<unknown>(r)),

  approve: (id: string, optionType: string) =>
    fetch(`/api/extension-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionType }),
    }).then((r) => json<unknown>(r)),

  offer: (id: string) =>
    fetch(`/api/extension-requests/${id}/offer`, { method: 'POST' }).then((r) => json<unknown>(r)),

  decline: (id: string, reason: string) =>
    fetch(`/api/extension-requests/${id}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).then((r) => json<unknown>(r)),

  setInterpretation: (id: string, requestedEndAt: string) =>
    fetch(`/api/extension-requests/${id}/interpretation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedEndAt }),
    }).then((r) => json<unknown>(r)),

  clarify: (id: string, body: string) =>
    fetch(`/api/extension-requests/${id}/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }).then((r) => json<unknown>(r)),

  reset: () => fetch('/api/dev/reset', { method: 'POST' }).then((r) => json<unknown>(r)),

  playgroundReset: () => fetch('/api/playground/reset', { method: 'POST' }).then((r) => json<unknown>(r)),
  playgroundBookings: () => fetch('/api/playground/bookings').then((r) => json<PlaygroundBooking[]>(r)),
  playgroundCreateBooking: (input: BookingFormInput) =>
    fetch('/api/playground/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<PlaygroundBooking>(r)),
  playgroundUpdateBooking: (id: string, input: BookingFormInput) =>
    fetch(`/api/playground/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<PlaygroundBooking>(r)),
  playgroundCancelBooking: (id: string) =>
    fetch(`/api/playground/bookings/${id}`, { method: 'DELETE' }).then((r) => json<unknown>(r)),
};
