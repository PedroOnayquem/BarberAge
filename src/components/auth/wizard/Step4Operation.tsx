import { Input } from '../../ui/Input'
import { Select } from '../../ui/Select'
import { TimePickerField } from '../../ui/TimePickerField'
import {
  TIMEZONE_OPTIONS,
  type WizardData,
  type WizardErrors,
  type WizardSchedule,
} from './useWizardState'

type SetWizardField = <K extends keyof WizardData>(field: K, value: WizardData[K]) => void
type SetScheduleField = <K extends keyof WizardSchedule>(field: K, value: WizardSchedule[K]) => void

interface Step4OperationProps {
  data: WizardData
  errors: WizardErrors
  onFieldChange: SetWizardField
  onScheduleChange: SetScheduleField
}

interface ScheduleRowProps {
  label: string
  open: boolean
  start: string
  end: string
  startError?: string
  endError?: string
  onToggle: (next: boolean) => void
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

function ScheduleRow({
  label,
  open,
  start,
  end,
  startError,
  endError,
  onToggle,
  onStartChange,
  onEndChange,
}: ScheduleRowProps) {
  return (
    <div className="rounded-xl border border-[rgba(148,163,184,0.2)] bg-[rgba(2,6,23,0.6)] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#f8fafc]">{label}</p>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#cbd5e1]">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => onToggle(event.target.checked)}
            className="native-check"
          />
          {open ? 'Aberto' : 'Fechado'}
        </label>
      </div>

      {open ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(180px,220px)_auto_minmax(180px,220px)] sm:items-center">
          <TimePickerField
            label="Inicio"
            value={start}
            onChange={onStartChange}
            error={startError}
            columns={3}
            title={`Selecionar inicio - ${label}`}
          />
          <span className="px-1 text-center text-sm text-[#94a3b8]">ate</span>
          <TimePickerField
            label="Fim"
            value={end}
            onChange={onEndChange}
            error={endError}
            columns={3}
            title={`Selecionar fim - ${label}`}
          />
        </div>
      ) : (
        <p className="text-xs text-[#94a3b8]">Sem expediente neste periodo.</p>
      )}
    </div>
  )
}

export function Step4Operation({
  data,
  errors,
  onFieldChange,
  onScheduleChange,
}: Step4OperationProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input
          label="Quantidade de profissionais"
          type="number"
          min={0}
          value={data.professionalsCount}
          onChange={(event) => onFieldChange('professionalsCount', event.target.value)}
          error={errors.professionalsCount}
        />
        <Input
          label="Intervalo base (min)"
          type="number"
          min={1}
          value={data.slotIntervalMinutes}
          onChange={(event) => onFieldChange('slotIntervalMinutes', event.target.value)}
          error={errors.slotIntervalMinutes}
        />
        <Input
          label="Buffer entre atendimentos (min)"
          type="number"
          min={0}
          value={data.bufferMinutes}
          onChange={(event) => onFieldChange('bufferMinutes', event.target.value)}
          error={errors.bufferMinutes}
        />
      </div>

      <Select
        label="Timezone"
        value={data.timezone}
        onChange={(event) => onFieldChange('timezone', event.target.value)}
        error={errors.timezone}
      >
        {TIMEZONE_OPTIONS.map((timezone) => (
          <option key={timezone.value} value={timezone.value}>
            {timezone.label}
          </option>
        ))}
      </Select>

      <section className="space-y-3 rounded-2xl border border-[rgba(148,163,184,0.24)] bg-[rgba(15,23,42,0.72)] p-4">
        <div>
          <p className="text-sm font-semibold text-[#f8fafc]">Horario inicial</p>
          <p className="text-xs text-[#94a3b8]">
            Configuracao rapida para comecar: Seg-Sex 09:00-19:00, Sab 09:00-18:00, Dom fechado.
          </p>
        </div>

        <ScheduleRow
          label="Segunda a Sexta"
          open={data.schedule.weekdaysOpen}
          start={data.schedule.weekdaysStart}
          end={data.schedule.weekdaysEnd}
          startError={errors['schedule.weekdaysStart']}
          endError={errors['schedule.weekdaysEnd']}
          onToggle={(next) => onScheduleChange('weekdaysOpen', next)}
          onStartChange={(value) => onScheduleChange('weekdaysStart', value)}
          onEndChange={(value) => onScheduleChange('weekdaysEnd', value)}
        />

        <ScheduleRow
          label="Sabado"
          open={data.schedule.saturdayOpen}
          start={data.schedule.saturdayStart}
          end={data.schedule.saturdayEnd}
          startError={errors['schedule.saturdayStart']}
          endError={errors['schedule.saturdayEnd']}
          onToggle={(next) => onScheduleChange('saturdayOpen', next)}
          onStartChange={(value) => onScheduleChange('saturdayStart', value)}
          onEndChange={(value) => onScheduleChange('saturdayEnd', value)}
        />

        <ScheduleRow
          label="Domingo"
          open={data.schedule.sundayOpen}
          start={data.schedule.sundayStart}
          end={data.schedule.sundayEnd}
          startError={errors['schedule.sundayStart']}
          endError={errors['schedule.sundayEnd']}
          onToggle={(next) => onScheduleChange('sundayOpen', next)}
          onStartChange={(value) => onScheduleChange('sundayStart', value)}
          onEndChange={(value) => onScheduleChange('sundayEnd', value)}
        />
      </section>
    </div>
  )
}
