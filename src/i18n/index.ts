import { en, type Messages } from './en';

let messages: Messages = en;

/** Current message table. Components read strings as `m().nav.home`. */
export function m(): Messages {
  return messages;
}

export function setMessages(next: Messages): void {
  messages = next;
  document.documentElement.lang = next.lang;
  document.documentElement.dir = next.dir;
}

/** Fill {placeholders} in a message. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}
