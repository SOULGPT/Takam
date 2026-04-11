import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

export const EXCLUDED_CATEGORIES = ['Sleep', 'Work', 'Commute'];

/**
 * Detects the local device timezone
 */
export function getDeviceTimezone(): string {
  return dayjs.tz.guess();
}

/**
 * Formats a UTC timestamp to a specific timezone
 */
export function formatToTimezone(date: string | Date, tz: string, format = 'HH:mm') {
  return dayjs(date).tz(tz).format(format);
}

/**
 * Checks if a specific time entry is a "Green Zone" candidate
 */
export function isGreenZoneCandidate(category: string) {
  return !EXCLUDED_CATEGORIES.includes(category);
}

/**
 * Analyzes schedules of both users to identify "Green Zones"
 * Returns an array of time ranges (in UTC) that represent potential connection windows.
 */
export function findGreenZones(userAEvents: any[], userBEvents: any[], dayStart: dayjs.Dayjs) {
  const greenZones = [];
  const startOfPeriod = dayStart.startOf('day');
  const endOfPeriod = dayStart.endOf('day');

  // We iterate through every hour of the day (or 30m slots) to find overlaps
  // For a high-end UI, we can be more granular
  let currentStart: dayjs.Dayjs | null = null;

  for (let i = 0; i < 24 * 2; i++) { // 30-min slots
    const slotStart = startOfPeriod.add(i * 30, 'minute');
    const slotEnd = slotStart.add(30, 'minute');

    const isAFree = !userAEvents.some(e => 
      EXCLUDED_CATEGORIES.includes(e.category) && 
      dayjs(e.start_time).isBefore(slotEnd) && 
      dayjs(e.end_time).isAfter(slotStart)
    ) && (userAEvents.length > 0 || (slotStart.hour() >= 7 && slotStart.hour() < 23 && !(slotStart.hour() >= 9 && slotStart.hour() < 17)));

    const isBFree = !userBEvents.some(e => 
      EXCLUDED_CATEGORIES.includes(e.category) && 
      dayjs(e.start_time).isBefore(slotEnd) && 
      dayjs(e.end_time).isAfter(slotStart)
    ) && (userBEvents.length > 0 || (slotStart.hour() >= 7 && slotStart.hour() < 23 && !(slotStart.hour() >= 9 && slotStart.hour() < 17)));

    if (isAFree && isBFree) {
      if (!currentStart) currentStart = slotStart;
    } else {
      if (currentStart) {
        greenZones.push({ start: currentStart.toISOString(), end: slotStart.toISOString() });
        currentStart = null;
      }
    }
  }

  if (currentStart) {
    greenZones.push({ start: currentStart.toISOString(), end: endOfPeriod.toISOString() });
  }

  return greenZones;
}

export default dayjs;
