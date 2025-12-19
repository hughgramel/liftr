'use client'

import { cn } from '@/lib/utils'
import { WORKOUT_PROGRAM, getWorkoutDay } from '@/lib/workout-data'
import type { DayNumber } from '@/types/workout'
import { ChevronDown, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface DaySelectorProps {
  selectedDay: DayNumber
  onSelectDay: (day: DayNumber) => void
  lastCompletedDay: DayNumber | null
}

export default function DaySelector({ selectedDay, onSelectDay, lastCompletedDay }: DaySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedWorkout = getWorkoutDay(selectedDay)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'bg-white rounded-xl border-2 border-border',
          'hover:border-duo-blue transition-colors',
          isOpen && 'border-duo-blue'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-duo-blue flex items-center justify-center">
            <span className="text-white font-bold">{selectedDay}</span>
          </div>
          <div className="text-left">
            <p className="font-bold text-foreground">Day {selectedDay}</p>
            <p className="text-sm text-foreground-muted">{selectedWorkout.name}</p>
          </div>
        </div>
        <ChevronDown
          className={cn('w-5 h-5 text-foreground-muted transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border-2 border-border shadow-lg z-50 overflow-hidden animate-fade-in">
          {WORKOUT_PROGRAM.map((day) => {
            const isSelected = day.dayNumber === selectedDay
            const isLastCompleted = day.dayNumber === lastCompletedDay

            return (
              <button
                key={day.dayNumber}
                onClick={() => {
                  onSelectDay(day.dayNumber)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3',
                  'hover:bg-gray-50 transition-colors',
                  isSelected && 'bg-duo-blue/10'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      isSelected ? 'bg-duo-blue' : 'bg-gray-200'
                    )}
                  >
                    <span className={cn('font-bold', isSelected ? 'text-white' : 'text-gray-600')}>
                      {day.dayNumber}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-foreground">Day {day.dayNumber}</p>
                    <p className="text-sm text-foreground-muted">{day.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLastCompleted && (
                    <span className="text-xs bg-duo-green/10 text-duo-green px-2 py-1 rounded-full font-semibold">
                      Last done
                    </span>
                  )}
                  {isSelected && <Check className="w-5 h-5 text-duo-blue" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
