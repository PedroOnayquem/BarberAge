import { Camera } from 'lucide-react'
import { EditableAvatar } from './EditableAvatar'

interface ProfilePhotoUploaderProps {
  avatarUrl: string | null
  name: string
  loading?: boolean
  onPickFile?: (file: File | null) => void
}

// Compat shim for stale Vite HMR updates that may still reference this removed module.
// New implementation is EditableAvatar inside ProfileHeader/ClientProfilePage.
export function ProfilePhotoUploader({
  avatarUrl,
  name,
  loading = false,
  onPickFile,
}: ProfilePhotoUploaderProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <EditableAvatar
        src={avatarUrl}
        name={name}
        isLoading={loading}
        onPickFile={(file) => onPickFile?.(file)}
      />
      <p className="text-xs text-[var(--color-text-muted)]">
        Clique no avatar para alterar
      </p>
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">
        <Camera size={10} />
        Compat
      </span>
    </div>
  )
}
