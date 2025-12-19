'use client'

import { cn } from '@/lib/utils'
import { Timer, Pause, Play } from 'lucide-react'

interface WorkoutTimerProps {
  seconds: number
  isPaused: boolean
  onTogglePause: () => void
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function WorkoutTimer({ seconds, isPaused, onTogglePause }: WorkoutTimerProps) {
  return (
    <div className="bg-white border-b-2 border-border px-4 py-3">
      <div className="mx-auto max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Timer className={cn('w-5 h-5', isPaused ? 'text-duo-orange' : 'text-duo-green')} />
          <span
            className={cn(
              'font-mono text-2xl font-bold',
              isPaused ? 'text-duo-orange' : 'text-foreground'
            )}
          >
            {formatTime(seconds)}
          </span>
          {isPaused && (
            <span className="text-xs bg-duo-orange/10 text-duo-orange px-2 py-1 rounded-full font-semibold">
              PAUSED
            </span>
          )}
        </div>
        <button
          onClick={onTogglePause}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
            isPaused
              ? 'bg-duo-green/10 text-duo-green hover:bg-duo-green/20'
              : 'bg-duo-orange/10 text-duo-orange hover:bg-duo-orange/20'
          )}
        >
          {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
