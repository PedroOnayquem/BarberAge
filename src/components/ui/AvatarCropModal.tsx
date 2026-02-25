import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Upload, ZoomIn } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface AvatarCropModalProps {
  open: boolean
  title: string
  file: File | null
  loading?: boolean
  error?: string
  onClose: () => void
  onFileChange: (file: File | null) => void
  onConfirm: (file: File) => Promise<void> | void
}

const CROP_SIZE = 320
const OUTPUT_SIZE = 512
const PREVIEW_SIZE = 96

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function AvatarCropModal({
  open,
  title,
  file,
  loading = false,
  error,
  onClose,
  onFileChange,
  onConfirm,
}: AvatarCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<Point>({ x: 0, y: 0 })
  const dragPosStartRef = useRef<Point>({ x: 0, y: 0 })
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!file) {
      setImageSrc(null)
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return 1
    return Math.max(CROP_SIZE / naturalSize.width, CROP_SIZE / naturalSize.height)
  }, [naturalSize.height, naturalSize.width])

  function clampPosition(next: Point, nextZoom = zoom): Point {
    if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 }
    const scale = baseScale * nextZoom
    const halfW = (naturalSize.width * scale) / 2
    const halfH = (naturalSize.height * scale) / 2
    const maxX = Math.max(0, halfW - CROP_SIZE / 2)
    const maxY = Math.max(0, halfH - CROP_SIZE / 2)
    return {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    }
  }

  function renderCroppedCanvas(size: number): HTMLCanvasElement | null {
    const img = imageRef.current
    if (!img || !naturalSize.width || !naturalSize.height) return null

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    const scale = baseScale * zoom
    const outScale = size / CROP_SIZE

    ctx.save()
    ctx.translate(size / 2 + position.x * outScale, size / 2 + position.y * outScale)
    ctx.scale(scale * outScale, scale * outScale)
    ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2, naturalSize.width, naturalSize.height)
    ctx.restore()

    return canvas
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = renderCroppedCanvas(PREVIEW_SIZE)
      if (!canvas) {
        setPreviewUrl(null)
        return
      }
      setPreviewUrl(canvas.toDataURL('image/png'))
    }, 40)
    return () => window.clearTimeout(timer)
  }, [zoom, position.x, position.y, baseScale, naturalSize.width, naturalSize.height])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!imageSrc) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragPosStartRef.current = { ...position }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    const next = clampPosition({
      x: dragPosStartRef.current.x + dx,
      y: dragPosStartRef.current.y + dy,
    })
    setPosition(next)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function handleZoomChange(nextZoom: number) {
    const safeZoom = clamp(nextZoom, 1, 3)
    setZoom(safeZoom)
    setPosition((prev) => clampPosition(prev, safeZoom))
  }

  async function handleConfirm() {
    const canvas = renderCroppedCanvas(OUTPUT_SIZE)
    if (!canvas) return

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/png')
    )
    if (!blob) return

    const cropped = new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' })
    await onConfirm(cropped)
  }

  function handleDroppedFile(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0] || null
    if (dropped) onFileChange(dropped)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {!imageSrc ? (
          <div
            className="rounded-xl border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDroppedFile}
          >
            <Upload className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--color-text)]">Arraste uma imagem aqui</p>
            <p className="text-xs text-[var(--color-text-muted)]">ou clique para selecionar</p>
            <label className="native-upload-trigger mt-4">
              Selecionar imagem
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr,160px]">
            <div className="space-y-3">
              <div
                className="relative mx-auto h-[320px] w-[320px] touch-none overflow-hidden rounded-xl bg-[var(--color-text)]/10"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Preview do avatar"
                  draggable={false}
                  onLoad={(e) => {
                    const target = e.currentTarget
                    setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight })
                  }}
                  className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                  style={{
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${baseScale * zoom})`,
                    transformOrigin: 'center center',
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at center, transparent 48%, rgba(10,31,68,0.45) 49%, rgba(10,31,68,0.45) 100%)',
                  }}
                />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90" />
              </div>

              <div className="flex items-center gap-3">
                <ZoomIn size={16} className="text-[var(--color-text-muted)]" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className="native-range"
                />
                <span className="w-12 text-right text-xs font-medium text-[var(--color-text-muted)]">{Math.round(zoom * 100)}%</span>
              </div>

              <div className="flex items-center justify-between">
                <label className="native-upload-trigger">
                  Trocar imagem
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-xs text-[var(--color-text-muted)]">Saida: 512x512 PNG</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Preview</p>
              <div className="flex justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview circular"
                    className="h-24 w-24 rounded-full border border-[var(--color-border)] object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)]" />
                )}
              </div>
            </div>
          </div>
        )}

        {error && <div className="rounded-lg bg-[var(--color-primary-soft)] px-3 py-2 text-sm text-[var(--color-primary)]">{error}</div>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" loading={loading} onClick={handleConfirm} disabled={!imageSrc || loading}>
            Salvar avatar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
