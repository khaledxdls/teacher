import { DateKey, TimeOfDay } from './types';

/** One calendar event, already described in the user's language. */
export type IcsEvent = {
  id: string;
  date: DateKey;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  title: string;
  location?: string;
  description?: string;
};

/** Escapes text values (RFC 5545 §3.3.11). */
const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const utf8Length = (char: string) => (char.codePointAt(0)! < 0x80 ? 1 : char.codePointAt(0)! < 0x800 ? 2 : char.codePointAt(0)! < 0x10000 ? 3 : 4);

/** Folds lines longer than 75 octets (RFC 5545 §3.1), without splitting characters. */
export function foldLine(line: string) {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = utf8Length(char);
    // Continuation lines start with a space, which counts toward their 75 octets.
    const limit = parts.length ? 74 : 75;
    if (size + charSize > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Local "floating" time: the event happens at this wall-clock time wherever the calendar is. */
const localDateTime = (date: DateKey, time: TimeOfDay) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

const utcStamp = (now: Date) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Builds an iCalendar file that Google Calendar, Apple Calendar and Outlook can import. */
export function toIcs(events: IcsEvent[], options: { calendarName: string; now: Date }): string {
  const stamp = utcStamp(options.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClassPilot//Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
    ...events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${event.id}@classpilot.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localDateTime(event.date, event.startTime)}`,
      `DTEND:${localDateTime(event.date, event.endTime)}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
