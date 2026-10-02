import type { ExtensionRequestDetail, EngineOption, Badge } from './types';
import { formatDateTime, formatMoney } from './format';

export const BADGE_LABEL: Record<Badge, string> = {
  CLEAN: 'Clean yes',
  CONFLICT: 'Conflict',
  NEEDS_DATE: 'Needs date',
  OFFERED: 'Offered',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  NOT_EXTENSION: 'Not an extension',
};

export function optionTitle(o: EngineOption, detail: ExtensionRequestDetail, timezone: string): string {
  if (o.type === 'REASSIGN_NEXT') {
    const firstName = detail.reassign?.nextRenterName.split(' ')[0] ?? 'next renter';
    return `Full extension + move ${firstName} to the ${detail.reassign?.toVehicleName ?? ''}`;
  }
  return `Extend until ${formatDateTime(o.newEndAt, timezone)}`;
}

export function optionButton(o: EngineOption, status: string): string {
  if (status === 'OFFERED' && o.type === 'PARTIAL') return 'Mark accepted';
  if (o.type === 'PARTIAL') return 'Send offer';
  return `Approve & charge ${formatMoney(o.quote?.totalCents ?? 0)}`;
}

export function optionNote(o: EngineOption, detail: ExtensionRequestDetail, status: string): string {
  if (status === 'OFFERED' && o.type === 'PARTIAL') {
    const firstName = detail.renter?.name.split(' ')[0] ?? 'the renter';
    return `Waiting for ${firstName} to reply YES`;
  }
  if (o.type === 'PARTIAL') return "Renter confirms before they're charged";
  if (o.type === 'REASSIGN_NEXT') return `Next renter keeps the same price · same class (${detail.reassign?.toVehicleCategory ?? ''})`;
  return '';
}

export function unavailableTitle(type: 'FULL' | 'REASSIGN_NEXT', detail: ExtensionRequestDetail, timezone: string): string {
  if (type === 'FULL') {
    return `Full extension to ${detail.interpretedEndAt ? formatDateTime(detail.interpretedEndAt, timezone) : ''}`;
  }
  return 'Move next renter to another car';
}

export function askText(detail: ExtensionRequestDetail, timezone: string): string {
  const first = detail.renter?.name.split(' ')[0] ?? 'Renter';
  return `${first} asked for ${detail.interpretedEndAt ? formatDateTime(detail.interpretedEndAt, timezone) : ''}`;
}

export function successBannerText(detail: ExtensionRequestDetail, timezone: string): string {
  return `Extended to ${formatDateTime(detail.chosenEndAt!, timezone)} · ${formatMoney(detail.charge?.amountCents ?? 0)} charged · confirmation sent`;
}

export function receiptText(detail: ExtensionRequestDetail): string {
  if (!detail.receipt) return '';
  const lines = detail.receipt.filter((l) => l.label !== 'Total');
  const total = detail.receipt.find((l) => l.label === 'Total');
  return `${lines.map((l) => l.label).join(' + ')} · Total ${total ? formatMoney(total.amountCents) : ''}`;
}

export function declinedBannerText(detail: ExtensionRequestDetail): string {
  return `Declined — ${detail.declineReason}`;
}
