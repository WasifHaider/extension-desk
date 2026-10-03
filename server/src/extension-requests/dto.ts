import { OptionType } from '../extensions/engine/types';

export interface ApproveDto {
  optionType: OptionType;
}

export interface DeclineDto {
  reason: string;
}

export interface InterpretationDto {
  requestedEndAt: string;
}

export interface ClarifyDto {
  body: string;
}
