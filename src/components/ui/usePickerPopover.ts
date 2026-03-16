import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

interface UsePickerPopoverOptions {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  triggerRef: RefObject<HTMLElement | null>
  minDesktopWidth?: number
  maxWidth?: number
  estimatedHeight?: number
  offset?: number
  viewportPadding?: number
}

export function usePickerPopover({
  open,
  onClose,
  containerRef,
  triggerRef,
  minDesktopWidth = 0,
  maxWidth = 360,
  estimatedHeight = 320,
  offset = 8,
  viewportPadding = 12,
}: UsePickerPopoverOptions) {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!open) return

    function updatePopoverPosition() {
      if (!triggerRef.current) return

      const rect = triggerRef.current.getBoundingClientRect()
      const desktopMinWidth = window.innerWidth >= 1024 ? minDesktopWidth : 0
      const targetWidth = Math.max(rect.width, desktopMinWidth)
      const maxAllowedWidth = Math.min(maxWidth, Math.max(0, window.innerWidth - viewportPadding * 2))
      const width = Math.max(Math.min(targetWidth, maxAllowedWidth), Math.min(rect.width, maxAllowedWidth))

      let left = rect.left
      if (left + width > window.innerWidth - viewportPadding) {
        left = window.innerWidth - viewportPadding - width
      }
      if (left < viewportPadding) left = viewportPadding

      const spaceBelow = window.innerHeight - rect.bottom
      const shouldFlip = spaceBelow < estimatedHeight && rect.top > estimatedHeight
      const top = shouldFlip ? rect.top - offset : rect.bottom + offset

      setPopoverStyle({
        position: 'fixed',
        top,
        left,
        width,
        zIndex: 9999,
        transform: shouldFlip ? 'translateY(-100%)' : 'none',
      })
    }

    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)

    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [estimatedHeight, maxWidth, minDesktopWidth, offset, open, triggerRef, viewportPadding])

  useEffect(() => {
    if (!open) return

    function handlePointerOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null
      if (!target) return

      const clickedInsideTrigger = !!containerRef.current?.contains(target)
      const clickedInsidePopover = !!popoverRef.current?.contains(target)
      if (!clickedInsideTrigger && !clickedInsidePopover) {
        onClose()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerOutside)
    document.addEventListener('touchstart', handlePointerOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerOutside)
      document.removeEventListener('touchstart', handlePointerOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [containerRef, onClose, open])

  return {
    popoverRef,
    popoverStyle,
  }
}
