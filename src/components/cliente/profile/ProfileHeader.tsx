import { EditableAvatar } from './EditableAvatar'

interface ProfileHeaderProps {
  avatarUrl: string | null
  name: string
  email: string
  avatarLoading: boolean
  onPickAvatarFile: (file: File | null) => void
}

export function ProfileHeader({
  avatarUrl,
  name,
  email,
  avatarLoading,
  onPickAvatarFile,
}: ProfileHeaderProps) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto mb-3 flex w-fit items-center justify-center">
        <EditableAvatar
          src={avatarUrl}
          name={name}
          isLoading={avatarLoading}
          onPickFile={onPickAvatarFile}
        />
      </div>
      <p className="text-lg font-bold text-[var(--color-text)]">{name}</p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{email}</p>
    </section>
  )
}
