import type { WorkoutDay } from '@/types/workout'

export const WORKOUT_PROGRAM: WorkoutDay[] = [
  {
    dayNumber: 1,
    name: 'Upper A',
    exercises: [
      { name: 'Incline Bench Press', tier: 'T1', sets: 5, reps: 3 },
      { name: 'Overhead Press', tier: 'T2', sets: 3, reps: 10 },
      { name: 'Pull-ups', tier: 'T3', sets: 3, reps: 15 },
      { name: 'Lateral Raises', tier: 'T3', sets: 3, reps: 15 },
    ],
  },
  {
    dayNumber: 2,
    name: 'Legs & Posterior',
    exercises: [
      { name: 'Bulgarian Split Squats', tier: 'T1', sets: 5, reps: 3 },
      { name: 'Hip Thrusts', tier: 'T2', sets: 3, reps: 10 },
      { name: 'Face Pulls', tier: 'T3', sets: 3, reps: 15 },
      { name: 'Calf Raises', tier: 'T3', sets: 3, reps: 15 },
    ],
  },
  {
    dayNumber: 3,
    name: 'Upper B',
    exercises: [
      { name: 'Overhead Press', tier: 'T1', sets: 5, reps: 3 },
      { name: 'Incline Bench Press', tier: 'T2', sets: 3, reps: 10 },
      { name: 'Barbell Rows', tier: 'T3', sets: 3, reps: 15 },
      { name: 'Dips', tier: 'T3', sets: 3, reps: 15 },
    ],
  },
  {
    dayNumber: 4,
    name: 'Posterior & Back',
    exercises: [
      { name: 'Hip Thrusts', tier: 'T1', sets: 5, reps: 3 },
      { name: 'Barbell Rows', tier: 'T2', sets: 3, reps: 10 },
      { name: 'Pull-ups', tier: 'T3', sets: 3, reps: 15 },
      { name: 'Bicep Curls', tier: 'T3', sets: 3, reps: 15 },
    ],
  },
]

export function getWorkoutDay(dayNumber: 1 | 2 | 3 | 4): WorkoutDay {
  // dayNumber is constrained to 1-4, so index 0-3 always exists
  return WORKOUT_PROGRAM[dayNumber - 1] as WorkoutDay
}

export function getNextDay(lastDay: 1 | 2 | 3 | 4 | null): 1 | 2 | 3 | 4 {
  if (lastDay === null) return 1
  return ((lastDay % 4) + 1) as 1 | 2 | 3 | 4
}

export function getTierLabel(tier: 'T1' | 'T2' | 'T3'): string {
  switch (tier) {
    case 'T1':
      return 'Primary'
    case 'T2':
      return 'Secondary'
    case 'T3':
      return 'Accessory'
  }
}

export function getTierColor(tier: 'T1' | 'T2' | 'T3'): string {
  switch (tier) {
    case 'T1':
      return 'bg-duo-red text-white'
    case 'T2':
      return 'bg-duo-blue text-white'
    case 'T3':
      return 'bg-duo-purple text-white'
  }
}
