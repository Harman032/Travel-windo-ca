import { Pipe, PipeTransform } from '@angular/core';
import { TZ } from './tz';

/**
 * Renders a date in the business timezone (America/Toronto), with DST handled.
 *
 * Angular's built-in `| date` pipe CANNOT do this. Its `timezone` argument — and the
 * DATE_PIPE_DEFAULT_OPTIONS provider — are passed to `timezoneToOffset()`, which resolves them
 * with `Date.parse('Jan 01, 1970 00:00:00 ' + timezone)`. That yields NaN for an IANA zone name
 * like 'America/Toronto' and silently falls back to the viewer's own offset, and an abbreviation
 * like 'EST' resolves to a FIXED -5 with no DST, which is wrong from March to November.
 * So the zone has to come from `Intl.DateTimeFormat`, which is what this pipe does.
 *
 * Supported formats are the ones the app actually uses, plus the Canadian form for the supplier
 * statement. An unrecognised format falls back to 'dd-MM-yyyy'.
 */
@Pipe({ name: 'tzDate', standalone: true })
export class TzDatePipe implements PipeTransform {
  transform(value: unknown, format: string = 'dd-MM-yyyy', timeZone: string = TZ): string {
    if (value == null || value === '') return '';
    const d = new Date(value as any);
    if (isNaN(d.getTime())) return '';

    if (format === 'medium') {
      return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(d);
    }
    if (format === 'long') {
      return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'medium', timeStyle: 'long' }).format(d);
    }

    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).formatToParts(d).map(x => [x.type, x.value])
    ) as Record<string, string>;

    switch (format) {
      case 'yyyy-MM-dd':       return `${p['year']}-${p['month']}-${p['day']}`;
      case 'dd-MM-yyyy HH:mm': return `${p['day']}-${p['month']}-${p['year']} ${p['hour']}:${p['minute']}`;
      case 'dd-MM-yyyy':
      default:                 return `${p['day']}-${p['month']}-${p['year']}`;
    }
  }
}
