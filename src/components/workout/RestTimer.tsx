'use client'

import { useEffect, useCallback } from 'react'
import { X, Volume2 } from 'lucide-react'
import Button from '@/components/ui/Button'

interface RestTimerProps {
  seconds: number
  totalSeconds: number
  onSkip: () => void
  onComplete: () => void
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function RestTimer({ seconds, totalSeconds, onSkip, onComplete }: RestTimerProps) {
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100

  const playBeep = useCallback(() => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audioContext = new AudioContext()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800
        oscillator.type = 'sine'
        gainNode.gain.value = 0.3

        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.2)

        // Play three beeps
        setTimeout(() => {
          const osc2 = audioContext.createOscillator()
          const gain2 = audioContext.createGain()
          osc2.connect(gain2)
          gain2.connect(audioContext.destination)
          osc2.frequency.value = 800
          osc2.type = 'sine'
          gain2.gain.value = 0.3
          osc2.start()
          osc2.stop(audioContext.currentTime + 0.2)
        }, 250)

        setTimeout(() => {
          const osc3 = audioContext.createOscillator()
          const gain3 = audioContext.createGain()
          osc3.connect(gain3)
          gain3.connect(audioContext.destination)
          osc3.frequency.value = 1000
          osc3.type = 'sine'
          gain3.gain.value = 0.3
          osc3.start()
          osc3.stop(audioContext.currentTime + 0.3)
        }, 500)
      } catch {
        // Audio not supported
      }
    }

    // Also try vibration
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300])
    }
  }, [])

  useEffect(() => {
    if (seconds === 0) {
      playBeep()
      onComplete()
    }
  }, [seconds, onComplete, playBeep])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-8 mx-4 w-full max-w-sm text-center animate-bounce-in">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Volume2 className="w-5 h-5 text-duo-blue" />
          <h3 className="text-lg font-bold text-foreground">Rest Time</h3>
        </div>

        {/* Circular Progress */}
        <div className="relative w-40 h-40 mx-auto my-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e5e5" strokeWidth="8" />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#1cb0f6"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-foreground font-mono">{formatTime(seconds)}</span>
          </div>
        </div>

        <p className="text-foreground-muted mb-6">Get ready for your next set</p>

        <Button variant="outline" onClick={onSkip} className="w-full">
          <X className="w-5 h-5 mr-2" />
          Skip Rest
        </Button>
      </div>
    </div>
  )
}
