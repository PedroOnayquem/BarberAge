import { addDays } from 'date-fns'

type DateInput = Date | string

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getPartsFormatter(timeZone: string) {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

function toDate(input: DateInput) {
  return input instanceof Date ? input : new Date(input)
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? ''
}

function getZonedDateParts(input: DateInput, timeZone: string) {
  const date = toDate(input)
  const parts = getPartsFormatter(timeZone).formatToParts(date)

  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
    second: readPart(parts, 'second'),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone)
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )

  return asUtc - date.getTime()
}

function normalizeTimeText(time: string) {
  return time.length === 5 ? `${time}:00` : time
}

export function formatCalendarDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTimeZoneDateKey(input: DateInput, timeZone: string) {
  const parts = getZonedDateParts(input, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatTimeInTimeZone(input: DateInput, timeZone: string, locale = 'pt-BR') {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toDate(input))
}

export function formatShortDateTimeInTimeZone(input: DateInput, timeZone: string) {
  const parts = getZonedDateParts(input, timeZone)
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

export function formatLongDateTimeInTimeZone(input: DateInput, timeZone: string, locale = 'pt-BR') {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(toDate(input))

  const weekday = readPart(parts, 'weekday')
  const day = readPart(parts, 'day')
  const month = readPart(parts, 'month')
  const hour = readPart(parts, 'hour')
  const minute = readPart(parts, 'minute')

  return `${weekday}, ${day} de ${month} às ${hour}:${minute}`
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [yearText, monthText, dayText] = date.split('-')
  const [hourText, minuteText, secondText = '00'] = normalizeTimeText(time).split(':')

  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second)
  const initialOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let zonedDate = new Date(utcGuess - initialOffset)

  const correctedOffset = getTimeZoneOffsetMs(zonedDate, timeZone)
  if (correctedOffset !== initialOffset) {
    zonedDate = new Date(utcGuess - correctedOffset)
  }

  return zonedDate
}

export function zonedDateTimeToUtcIso(date: string, time: string, timeZone: string) {
  return zonedDateTimeToUtc(date, time, timeZone).toISOString()
}

export function getUtcRangeForLocalDate(date: Date, timeZone: string) {
  const startDate = formatCalendarDate(date)
  const nextDate = formatCalendarDate(addDays(date, 1))

  return {
    startIso: zonedDateTimeToUtcIso(startDate, '00:00:00', timeZone),
    endExclusiveIso: zonedDateTimeToUtcIso(nextDate, '00:00:00', timeZone),
  }
}

export function getUtcRangeForLocalWeek(weekStart: Date, timeZone: string) {
  const startDate = formatCalendarDate(weekStart)
  const nextWeekDate = formatCalendarDate(addDays(weekStart, 7))

  return {
    startIso: zonedDateTimeToUtcIso(startDate, '00:00:00', timeZone),
    endExclusiveIso: zonedDateTimeToUtcIso(nextWeekDate, '00:00:00', timeZone),
  }
}

export function getUtcRangeForLocalMonth(date: Date, timeZone: string) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const nextMonthStart = new Date(date.getFullYear(), date.getMonth() + 1, 1)

  return {
    startIso: zonedDateTimeToUtcIso(formatCalendarDate(monthStart), '00:00:00', timeZone),
    endExclusiveIso: zonedDateTimeToUtcIso(formatCalendarDate(nextMonthStart), '00:00:00', timeZone),
  }
}
