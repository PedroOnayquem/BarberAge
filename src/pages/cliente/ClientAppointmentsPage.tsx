import { useEffect, useState } from 'react'
import { CalendarCheck, Clock, XCircle, Upload, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { AvatarCropModal } from '../../components/ui/AvatarCropModal'
import { format, parseISO, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CLIENT_AVATARS_BUCKET, getSignedAvatarUrl, uploadClientAvatar, validateAvatarFile } from '../../lib/avatarStorage'
import { translateError } from '../../lib/errorMessages'

interface Appointment {
  id: string
  start_at: string
  end_at: string
  status: string
  notes: string | null
  created_at: string
  professionals: { name: string } | null
  appointment_services: {
    id: string
    duration_minutes: number
    price: number
    services: { name: string } | null
  }[]
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
}

const statusVariants: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'default',
  no_show: 'danger',
}

export function ClientAppointmentsPage() {
  const { clientUser, clientShop, clientProfile, refreshUserData, user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)

  useEffect(() => {
    if (clientUser && clientShop) loadAppointments()
  }, [clientUser, clientShop])

  useEffect(() => {
    let mounted = true
    async function loadAvatar() {
      const signed = await getSignedAvatarUrl(CLIENT_AVATARS_BUCKET, clientProfile?.avatar_url)
      if (mounted) setAvatarPreview(signed)
    }
    loadAvatar()
    return () => {
      mounted = false
    }
  }, [clientProfile?.avatar_url])

  async function loadAppointments() {
    if (!clientUser || !clientShop) return
    setLoading(true)

    const { data } = await supabase
      .from('appointments')
      .select('*, professionals(name), appointment_services(id, duration_minutes, price, services(name))')
      .eq('shop_id', clientShop.id)
      .eq('client_id', clientUser.client_id)
      .order('start_at', { ascending: false })

    setAppointments((data as any) || [])
    setLoading(false)
  }

  function openCancel(apt: Appointment) {
    setSelectedApt(apt)
    setCancelModalOpen(true)
  }

  async function handleCancel() {
    if (!selectedApt) return
    setCancelLoading(true)
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', selectedApt.id)
    setCancelLoading(false)
    setCancelModalOpen(false)
    loadAppointments()
  }

  function handleAvatarPick(file: File | null) {
    if (!file) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      setAvatarError(validationError)
      return
    }

    setAvatarError('')
    setPendingAvatarFile(file)
    setCropModalOpen(true)
  }

  async function handleAvatarCropped(croppedFile: File) {
    if (!clientUser || !clientShop || !clientProfile || !user?.id) {
      setAvatarError('Sessão inválida. Faça login novamente para enviar a imagem.')
      return
    }
    setAvatarLoading(true)

    try {
      const newPath = await uploadClientAvatar({
        file: croppedFile,
        shopId: clientShop.id,
        clientId: clientUser.client_id,
        previousPath: clientProfile.avatar_url,
      })

      const { error } = await supabase
        .from('clients')
        .update({ avatar_url: newPath })
        .eq('id', clientUser.client_id)

      if (error) throw error

      await refreshUserData()
      const signed = await getSignedAvatarUrl(CLIENT_AVATARS_BUCKET, newPath)
      setAvatarPreview(signed)
      setCropModalOpen(false)
      setPendingAvatarFile(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar imagem'
      setAvatarError(translateError(message))
    } finally {
      setAvatarLoading(false)
    }
  }

  const upcoming = appointments.filter(
    (a) => !isPast(parseISO(a.start_at)) && a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show'
  )
  const past = appointments.filter(
    (a) => isPast(parseISO(a.start_at)) || a.status === 'cancelled' || a.status === 'completed' || a.status === 'no_show'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b11226] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0a1f44]">Meus Agendamentos</h1>
        <p className="mt-1 text-sm text-[#6b7a95]">
          Acompanhe seus agendamentos
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Foto de perfil" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f1f4f8] text-[#6b7a95]">
              <ImageIcon size={22} />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#0a1f44]">Foto de perfil</p>
            <p className="text-xs text-[#6b7a95]">JPG, PNG, WEBP ou GIF. Máximo 2MB.</p>
            <label className="native-upload-trigger">
              <Upload size={16} />
              {avatarLoading ? 'Enviando...' : 'Alterar foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={avatarLoading}
                onChange={(e) => handleAvatarPick(e.target.files?.[0] || null)}
              />
            </label>
            {avatarError && <p className="text-xs text-[#b11226]">{avatarError}</p>}
          </div>
        </div>
      </Card>

      <AvatarCropModal
        open={cropModalOpen}
        title="Editar foto de perfil"
        file={pendingAvatarFile}
        loading={avatarLoading}
        error={avatarError}
        onClose={() => {
          if (!avatarLoading) {
            setCropModalOpen(false)
            setPendingAvatarFile(null)
          }
        }}
        onFileChange={handleAvatarPick}
        onConfirm={handleAvatarCropped}
      />

      {/* Upcoming */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-[#8b9bb8]">Próximos</h2>
        {upcoming.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-8">
              <CalendarCheck className="mb-2 h-10 w-10 text-[#a5b2ca]" />
              <p className="text-sm text-[#8b9bb8]">Nenhum agendamento futuro</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} onCancel={() => openCancel(apt)} showCancel />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-[#8b9bb8]">Histórico</h2>
          <div className="space-y-3">
            {past.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} />
            ))}
          </div>
        </div>
      )}

      {/* Cancel modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancelar agendamento" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fdecef]">
              <XCircle className="h-5 w-5 text-[#b11226]" />
            </div>
            <p className="text-sm text-[#425a7f]">
              Tem certeza que deseja cancelar este agendamento?
            </p>
          </div>
          {selectedApt && (
            <div className="rounded-lg bg-white p-3 text-sm">
              <p className="font-medium text-[#0a1f44]">
                {format(parseISO(selectedApt.start_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
              <p className="text-[#6b7a95]">
                {selectedApt.professionals?.name}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>Voltar</Button>
            <Button variant="danger" loading={cancelLoading} onClick={handleCancel}>Cancelar agendamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AppointmentCard({
  apt,
  onCancel,
  showCancel,
}: {
  apt: Appointment
  onCancel?: () => void
  showCancel?: boolean
}) {
  const totalPrice = apt.appointment_services.reduce((sum, s) => sum + Number(s.price), 0)

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#8b9bb8]" />
            <p className="text-sm font-semibold text-[#0a1f44]">
              {format(parseISO(apt.start_at), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <p className="text-sm text-[#6b7a95]">
            {apt.professionals?.name}
          </p>
          {apt.appointment_services.length > 0 && (
            <p className="text-xs text-[#8b9bb8]">
              {apt.appointment_services.map((s) => s.services?.name).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={statusVariants[apt.status] || 'default'}>
            {statusLabels[apt.status] || apt.status}
          </Badge>
          {totalPrice > 0 && (
            <span className="text-sm font-semibold text-[#0a1f44]">
              R$ {totalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      {showCancel && onCancel && (apt.status === 'pending' || apt.status === 'confirmed') && (
        <div className="mt-3 border-t border-[#e8edf5] pt-3">
          <button
            onClick={onCancel}
            className="text-sm text-[#b11226] hover:text-[#b11226]"
          >
            Cancelar agendamento
          </button>
        </div>
      )}
    </Card>
  )
}


