import type { Language } from "../preferences/types.ts";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeDate,
  formatShortDate,
  LANGUAGE_LOCALES,
  type DateInput,
} from "./formatters.ts";
import { translate, type MessageKey, type MessageValues } from "./messages.ts";

export interface PluralMessageKeys {
  zero?: MessageKey;
  one: MessageKey;
  other: MessageKey;
}

export function selectPluralMessage(
  language: Language,
  value: number,
  keys: PluralMessageKeys,
): MessageKey {
  if (value === 0 && keys.zero) return keys.zero;
  const category = new Intl.PluralRules(LANGUAGE_LOCALES[language]).select(
    value,
  );
  return category === "one" ? keys.one : keys.other;
}

export interface I18nApi {
  language: Language;
  locale: string;
  t: (key: MessageKey, values?: MessageValues) => string;
  plural: (
    value: number,
    keys: PluralMessageKeys,
    values?: MessageValues,
  ) => string;
  count: (
    value: number,
    keys: PluralMessageKeys,
    values?: MessageValues,
  ) => string;
  formatDate: (value: DateInput) => string;
  formatShortDate: (value: DateInput) => string;
  formatDateTime: (value: DateInput) => string;
  formatDateRange: (start: DateInput, end: DateInput) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number) => string;
  formatRelativeDate: (value: DateInput, now?: Date) => string;
}

export function createI18n(
  language: Language,
  options: { timeZone?: string } = {},
): I18nApi {
  const numberFormatter = (value: number, options?: Intl.NumberFormatOptions) =>
    formatNumber(language, value, options);

  const plural = (
    value: number,
    keys: PluralMessageKeys,
    values?: MessageValues,
  ) =>
    translate(language, selectPluralMessage(language, value, keys), {
      ...values,
      count: numberFormatter(value),
    });

  return {
    language,
    locale: LANGUAGE_LOCALES[language],
    t: (key, values) => translate(language, key, values),
    plural,
    count: plural,
    formatDate: (value) => formatDate(language, value),
    formatShortDate: (value) => formatShortDate(language, value),
    formatDateTime: (value) =>
      formatDateTime(language, value, options.timeZone),
    formatDateRange: (start, end) => formatDateRange(language, start, end),
    formatNumber: numberFormatter,
    formatPercent: (value) => formatPercent(language, value),
    formatRelativeDate: (value, now) =>
      formatRelativeDate(language, value, now),
  };
}
