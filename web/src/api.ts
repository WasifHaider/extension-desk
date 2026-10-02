import type { Vehicle, RenterPickerEntry, Message, InboxRow, ExtensionRequestDetail, Meta } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
  return res.json();
}

export const api = {
  meta: () => fetch('/api/meta').then((r) => json<Meta>(r)),
  vehicles: () => fetch('/api/vehicles').then((r) => json<Vehicle[]>(r)),
  renters: () => fetch('/api/renters').then((r) => json<RenterPickerEntry[]>(r)),
  messages: (renterId: string) => fetch(`/api/messages?renterId=${renterId}`).then((r) => json<Message[]>(r)),
  inbox: () => fetch('/api/extension-requests').then((r) => json<InboxRow[]>(r)),
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
};
