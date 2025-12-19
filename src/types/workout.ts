export type DayNumber = 1 | 2 | 3 | 4

export type Tier = 'T1' | 'T2' | 'T3'

export interface Exercise {
  name: string
  tier: Tier
  sets: number
  reps: number
}

export interface WorkoutDay {
  dayNumber: DayNumber
  name: string
  exercises: Exercise[]
}

export interface SetLog {
  setNumber: number
  targetReps: number
  actualReps: number
  weight: number
  completed: boolean
}

export interface ExerciseLog {
  name: string
  tier: Tier
  sets: SetLog[]
}

export interface WorkoutHistory {
  id: string
  date: string
  dayNumber: DayNumber
  dayName: string
  duration: number
  exercises: ExerciseLog[]
}

export interface UserSettings {
  restTimerSeconds: number
  timePerRepSeconds: number
  lastCompletedDay: DayNumber | null
}

export interface ExerciseWeights {
  [exerciseName: string]: number
}
