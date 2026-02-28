import { Camera } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

interface EditableAvatarProps {
  src: string | null
  name: string
  isLoading: boolean
  onPickFile: (file: File | null) => void
}

export function EditableAvatar({ src, name, isLoading, onPickFile }: EditableAvatarProps) {
  const inputId = useId()
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [src])

  return (
    <label
      htmlFor={inputId}
      className="group relative inline-flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] shadow-[var(--shadow-card)]"
      title="Alterar foto de perfil"
    >
      {isLoading ? (
        <div className="avatar-skeleton h-full w-full rounded-full" />
      ) : src && !imageError ? (
        <img
          src={src}
          alt={`Foto de perfil de ${name}`}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-[var(--color-text)]">
          {name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-[rgba(2,6,23,0.48)] text-white opacity-90 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <Camera size={16} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Alterar</span>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onPickFile(e.target.files?.[0] || null)}
      />
    </label>
  )
}

