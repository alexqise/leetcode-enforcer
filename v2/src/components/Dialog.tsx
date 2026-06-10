import { type ReactNode, useEffect, useRef } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Icon rendered in the tinted square next to the title. */
  mark?: ReactNode
  /** Tint for the mark square. */
  markTone?: 'warning' | 'neutral'
  children: ReactNode
  /** Action buttons row (right-aligned). */
  actions: ReactNode
  /** Error line below the actions; reserved space, role=alert. */
  error?: string
}

const markTones = {
  warning: 'border-[rgba(226,169,91,0.25)] bg-[rgba(226,169,91,0.10)] text-medium',
  neutral: 'border-border-2 bg-surface-2 text-fg-2',
}

/**
 * Shared modal (design.md §5.16 — native dialogs are banned). Backdrop
 * click and Escape close it; the panel autofocuses its first
 * [data-autofocus] element, falling back to the panel itself.
 */
export function Dialog({
  open,
  onClose,
  title,
  mark,
  markTone = 'warning',
  children,
  actions,
  error,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
    ;(target ?? panelRef.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss is supplementary to Escape + Cancel
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled at the document level
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,4,10,0.65)] p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-[min(440px,100%)] rounded-xl border border-border-2 bg-surface p-6 text-fg shadow-[0_24px_64px_rgba(0,0,0,0.5)] outline-none motion-safe:animate-modal-in"
      >
        <div className="mb-3 flex items-center gap-3">
          {mark && (
            <div
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${markTones[markTone]}`}
            >
              {mark}
            </div>
          )}
          <div className="text-base font-semibold tracking-[-0.015em] text-fg">{title}</div>
        </div>

        {children}

        <div className="flex justify-end gap-2">{actions}</div>

        <div role="alert" className="mt-2.5 min-h-4 text-[11.5px] tracking-[-0.003em] text-hard">
          {error}
        </div>
      </div>
    </div>
  )
}
