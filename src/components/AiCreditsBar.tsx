'use client'

import React from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import type { AiCreditsInfo } from '@/hooks/useUserProfile'

interface AiCreditsBarProps {
  credits: AiCreditsInfo
  compact?: boolean
}

export function AiCreditsBar({ credits, compact = false }: AiCreditsBarProps) {
  const { used, total, remaining, resetAt } = credits
  const pct = Math.min(100, Math.round((used / total) * 100))
  const isLow = remaining <= Math.floor(total * 0.15)
  const isEmpty = remaining === 0

  // Data prossimo reset: stesso giorno del mese successivo, clampato all'ultimo giorno del mese
  // (es. 31 gennaio → 28/29 febbraio, non 3 marzo)
  const resetDate = resetAt
    ? (() => {
        const src = new Date(resetAt)
        const nextYear = src.getMonth() === 11 ? src.getFullYear() + 1 : src.getFullYear()
        const nextMonth = (src.getMonth() + 1) % 12
        // Giorno 0 del mese successivo = ultimo giorno del mese target
        const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
        return new Date(nextYear, nextMonth, Math.min(src.getDate(), lastDayOfNextMonth))
      })()
    : null
  const resetLabel = resetDate
    ? resetDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
    : null

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Sparkles size={13} className={isEmpty ? 'text-red-400' : isLow ? 'text-amber-500' : 'text-[#7B5CF6]'} />
        <span className={`text-xs font-bold ${isEmpty ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-[#7B5CF6]'}`}>
          {remaining}/{total}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#EEF0F4] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#F4EEFF] flex items-center justify-center">
            <Sparkles size={16} className="text-[#7B5CF6]" />
          </div>
          <div>
            <p className="text-sm font-black text-[#1C1C1E]">Crediti AI</p>
            <p className="text-xs text-[#9AA2B1] font-medium">
              {remaining} rimanenti su {total}
            </p>
          </div>
        </div>
        {resetLabel && (
          <div className="flex items-center gap-1 text-[10px] text-[#9AA2B1] font-medium">
            <RefreshCw size={10} />
            {resetLabel}
          </div>
        )}
      </div>

      {/* Barra progressione */}
      <div className="h-2 bg-[#F4F4F8] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isEmpty ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-[#7B5CF6]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isEmpty && (
        <p className="text-xs font-bold text-red-500 bg-red-50 rounded-xl px-3 py-2">
          Crediti esauriti. Aggiorna a Premium per ottenere 300 crediti/mese oppure attendi il rinnovo.
        </p>
      )}
      {isLow && !isEmpty && (
        <p className="text-xs font-bold text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
          Crediti quasi esauriti. Con Premium hai 300 crediti al mese.
        </p>
      )}
    </div>
  )
}

// Costi per azione, da mostrare in UI
export const CREDIT_COST_LABELS = {
  chat: '2 crediti',
  vision: '5 crediti',
  image_fast: '8 crediti',
  image_hd: '20 crediti',
} as const
