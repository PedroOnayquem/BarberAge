import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Locale,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DatePickerCardProps {
  value: Date
  onChange: (date: Date) => void
  minDate?: Date
  locale?: Locale
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export function DatePickerCard({
  value,
  onChange,
  minDate,
  locale = ptBR,
  weekStartsOn = 1,
}: DatePickerCardProps) {
  const [viewDate, setViewDate] = useState(startOfMonth(value))
  const today = startOfDay(new Date())
  const minDay = minDate ? startOfDay(minDate) : null

  useEffect(() => {
    setViewDate(startOfMonth(value))
  }, [value])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn })
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn })
    const out: Date[] = []
    let cursor = start
    while (!isBefore(end, cursor)) {
      out.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return out
  }, [viewDate, weekStartsOn])

  const weekdayBase = startOfWeek(new Date(), { weekStartsOn })
  const weekLabels = Array.from({ length: 7 }, (_, index) =>
    format(addDays(weekdayBase, index), 'EEEEE', { locale }).toUpperCase()
  )

  return (
    <div className="barber-datepicker">
      <div className="barber-datepicker-header">
        <button
          type="button"
          className="barber-datepicker-nav"
          aria-label="Mês anterior"
          onClick={() => setViewDate(addMonths(startOfMonth(viewDate), -1))}
        >
          <ChevronLeft size={16} />
        </button>

        <h3 className="barber-datepicker-title">
          {format(viewDate, 'MMMM, yyyy', { locale })}
        </h3>

        <button
          type="button"
          className="barber-datepicker-nav"
          aria-label="Próximo mês"
          onClick={() => setViewDate(addMonths(startOfMonth(viewDate), 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="barber-datepicker-weekdays" aria-hidden="true">
        {weekLabels.map((label) => (
          <span key={label} className="barber-datepicker-weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="barber-datepicker-grid" role="grid" aria-label="Calendário">
        {days.map((day) => {
          const disabled = !!minDay && isBefore(day, minDay)
          const isSelected = isSameDay(day, value)
          const isToday = isSameDay(day, today)
          const outsideMonth = !isSameMonth(day, viewDate)
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              aria-pressed={isSelected}
              aria-label={format(day, "EEEE, dd 'de' MMMM", { locale })}
              disabled={disabled}
              onClick={() => onChange(day)}
              className={`barber-datepicker-day ${outsideMonth ? 'is-outside' : ''} ${
                isToday ? 'is-today' : ''
              } ${isSelected ? 'is-selected' : ''}`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
