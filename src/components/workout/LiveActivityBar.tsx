'use client'

import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

interface LiveActivityBarProps {
  dayNumber: number
  dayName: string
  elapsedSeconds: number
  completedSets: number
  totalSets: number
  onResume: () => void
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

export default function LiveActivityBar({
  elapsedSeconds,
  completedSets,
  totalSets,
  onResume,
}: LiveActivityBarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const progress = (completedSets / totalSets) * 100

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-duo-green transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        onClick={onResume}
        className="w-full bg-white border-t-2 border-border px-6 py-5 flex items-center justify-between active:bg-gray-50 transition-colors"
      >
        {/* Sets counter - left aligned */}
        <div className="text-left">
          <p className="text-3xl font-bold text-foreground">
            {completedSets}/{totalSets}
          </p>
          <p className="text-sm text-foreground-muted font-medium">sets</p>
        </div>

        {/* Timer - center aligned */}
        <div className="text-center">
          <p className="text-3xl font-bold text-duo-green font-mono">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-sm text-foreground-muted font-medium">elapsed</p>
        </div>

        {/* Resume button - right aligned */}
        <div className="flex items-center gap-2 bg-duo-green text-white px-5 py-3 rounded-2xl">
          <span className="text-lg font-bold">Resume</span>
          <ChevronUp className="w-6 h-6" />
        </div>
      </button>

      {/* Safe area padding for mobile */}
      <div className="bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </div>
  )
}
