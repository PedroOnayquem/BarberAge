import { useEffect, useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AvatarCropModal } from '../../components/ui/AvatarCropModal'
import { Button } from '../../components/ui/Button'
import { ProfileForm } from '../../components/cliente/profile/ProfileForm'
import { ProfileHeader } from '../../components/cliente/profile/ProfileHeader'
import {
  CLIENT_AVATARS_BUCKET,
  getSignedAvatarUrl,
  uploadClientAvatar,
  validateAvatarFile,
} from '../../lib/avatarStorage'
import { translateError } from '../../lib/errorMessages'
import { formatPhone, normalizePhone } from '../../lib/phone'

export function ClientProfilePage() {
  const navigate = useNavigate()
  const {
    user,
    clientUser,
    clientShop,
    clientProfile,
    clientGlobalProfile,
    refreshUserData,
  } = useAuth()

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarResolving, setAvatarResolving] = useState(true)
  const [avatarError, setAvatarError] = useState('')
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let mounted = true
    async function loadAvatar() {
      setAvatarResolving(true)
      const signed = await getSignedAvatarUrl(CLIENT_AVATARS_BUCKET, clientProfile?.avatar_url)
      if (mounted) {
        setAvatarUrl(signed)
        setAvatarResolving(false)
      }
    }
    loadAvatar()
    return () => {
      mounted = false
    }
  }, [clientProfile?.avatar_url])

  useEffect(() => {
    setName(
      clientProfile?.name ||
      clientGlobalProfile?.name ||
      user?.email?.split('@')[0] ||
      'Cliente'
    )
    setPhone(formatPhone(clientProfile?.phone || clientGlobalProfile?.phone || ''))
    setEmail(clientProfile?.email || clientGlobalProfile?.email || user?.email || '')
  }, [clientProfile?.name, clientProfile?.phone, clientProfile?.email, clientGlobalProfile?.name, clientGlobalProfile?.phone, clientGlobalProfile?.email, user?.email])

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
      setAvatarError('Complete seu cadastro em uma barbearia para alterar foto de perfil.')
      return
    }
    setAvatarLoading(true)
    const previousAvatarUrl = avatarUrl
    const localPreviewUrl = URL.createObjectURL(croppedFile)
    setAvatarUrl(localPreviewUrl)

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
      setAvatarUrl(signed)
      URL.revokeObjectURL(localPreviewUrl)
      setCropModalOpen(false)
      setPendingAvatarFile(null)
    } catch (e) {
      URL.revokeObjectURL(localPreviewUrl)
      setAvatarUrl(previousAvatarUrl)
      const message = e instanceof Error ? e.message : 'Erro ao enviar imagem'
      setAvatarError(translateError(message))
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handleSubmitProfile(event: FormEvent) {
    event.preventDefault()
    setSaveError('')
    setSaveSuccess(false)

    const normalizedName = name.trim()
    const normalizedPhone = normalizePhone(phone)
    const normalizedEmail = email.trim() || user?.email || ''

    if (!normalizedName) {
      setSaveError('Informe seu nome.')
      return
    }

    if (!user) {
      setSaveError('Sessão inválida. Faça login novamente.')
      return
    }

    setSaveLoading(true)
    try {
      const metadata = {
        ...(user.user_metadata || {}),
        name: normalizedName,
        phone: normalizedPhone || null,
        role: 'client',
        account_type: 'client',
      }

      const { error: authError } = await supabase.auth.updateUser({ data: metadata })
      if (authError) throw authError

      if (clientUser && clientProfile) {
        const { error: clientError } = await supabase
          .from('clients')
          .update({
            name: normalizedName,
            phone: normalizedPhone || null,
            email: normalizedEmail || null,
          })
          .eq('id', clientUser.client_id)

        if (clientError) throw clientError
      }

      await refreshUserData()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o perfil.'
      setSaveError(translateError(message))
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 md:px-0 md:py-0">
      <ProfileHeader
        avatarUrl={avatarUrl}
        name={name}
        email={email || 'Não informado'}
        avatarLoading={avatarResolving}
        onPickAvatarFile={handleAvatarPick}
      />
      {avatarError && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-primary)]">
          {avatarError}
        </div>
      )}

      <ProfileForm
        name={name}
        phone={phone}
        email={email || 'Não informado'}
        loading={saveLoading}
        success={saveSuccess}
        error={saveError}
        onNameChange={setName}
        onPhoneChange={setPhone}
        onSubmit={handleSubmitProfile}
      />

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-card)]">
        <Button onClick={handleLogout} className="w-full" variant="danger">
          <LogOut size={16} />
          Sair da conta
        </Button>
      </section>

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
    </div>
  )
}
