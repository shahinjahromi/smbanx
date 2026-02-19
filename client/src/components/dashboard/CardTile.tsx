import { Link } from 'react-router-dom'
import type { Card } from '../../types'

interface CardTileProps {
  card: Card
}

export function CardTile({ card }: CardTileProps) {
  const mm = String(card.expiryMonth).padStart(2, '0')
  const yy = String(card.expiryYear).slice(-2)

  return (
    <Link
      to={`/cards/${card.id}`}
      className="block transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-2xl"
    >
      <div
        className="relative w-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-lg"
        style={{ aspectRatio: '1.586 / 1' }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between">
          {/* Chip */}
          <svg viewBox="0 0 34 26" className="h-7 w-10 text-yellow-300" fill="currentColor">
            <rect x="0" y="0" width="34" height="26" rx="4" fill="currentColor" opacity="0.15" />
            <rect x="0" y="0" width="34" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <line x1="0" y1="9" x2="34" y2="9" stroke="currentColor" strokeWidth="1.2" />
            <line x1="0" y1="17" x2="34" y2="17" stroke="currentColor" strokeWidth="1.2" />
            <line x1="12" y1="0" x2="12" y2="26" stroke="currentColor" strokeWidth="1.2" />
            <line x1="22" y1="0" x2="22" y2="26" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          {/* Network */}
          <span className="text-sm font-bold tracking-widest text-white/80">VISA</span>
        </div>

        {/* Card number */}
        <div className="mt-4 font-mono text-lg font-semibold tracking-widest text-white/90">
          •••• •••• •••• {card.last4}
        </div>

        {/* Bottom row */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">Expires</p>
            <p className="font-mono text-sm text-white/80">{mm}/{yy}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              card.status === 'ACTIVE'
                ? 'bg-green-500/20 text-green-300'
                : 'bg-red-500/20 text-red-300'
            }`}
          >
            {card.status === 'ACTIVE' ? 'Unlocked' : 'Locked'}
          </span>
        </div>
      </div>
    </Link>
  )
}
