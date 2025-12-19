import type { WorkoutHistory, UserSettings, ExerciseWeights, DayNumber } from '@/types/workout'
import { auth } from './firebase'
import { saveWorkoutToFirestore, saveSettingsToFirestore, saveWeightsToFirestore } from './firestore'

const STORAGE_KEYS = {
  WORKOUT_HISTORY: 'liftr_workout_history',
  USER_SETTINGS: 'liftr_user_settings',
  EXERCISE_WEIGHTS: 'liftr_exercise_weights',
} as const

// Helper to sync to Firestore if user is logged in
async function syncToFirestoreIfLoggedIn<T>(
  syncFn: (userId: string, data: T) => Promise<void>,
  data: T
): Promise<void> {
  const user = auth.currentUser
  if (user) {
    try {
      await syncFn(user.uid, data)
    } catch (error) {
      console.error('Failed to sync to Firestore:', error)
    }
  }
}

const DEFAULT_SETTINGS: UserSettings = {
  restTimerSeconds: 90,
  timePerRepSeconds: 3,
  lastCompletedDay: null,
}

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

function setToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    console.error(`Failed to save to localStorage: ${key}`)
  }
}

// Workout History
export function getWorkoutHistory(): WorkoutHistory[] {
  return getFromStorage<WorkoutHistory[]>(STORAGE_KEYS.WORKOUT_HISTORY, [])
}

export function addWorkoutToHistory(workout: WorkoutHistory): void {
  const history = getWorkoutHistory()
  history.unshift(workout)
  setToStorage(STORAGE_KEYS.WORKOUT_HISTORY, history)
  // Sync to Firestore
  syncToFirestoreIfLoggedIn(saveWorkoutToFirestore, workout)
}

export function getRecentWorkouts(limit: number = 5): WorkoutHistory[] {
  return getWorkoutHistory().slice(0, limit)
}

// User Settings
export function getUserSettings(): UserSettings {
  return getFromStorage<UserSettings>(STORAGE_KEYS.USER_SETTINGS, DEFAULT_SETTINGS)
}

export function updateUserSettings(settings: Partial<UserSettings>): void {
  const current = getUserSettings()
  const updated = { ...current, ...settings }
  setToStorage(STORAGE_KEYS.USER_SETTINGS, updated)
  // Sync to Firestore
  syncToFirestoreIfLoggedIn(saveSettingsToFirestore, updated)
}

export function getLastCompletedDay(): DayNumber | null {
  return getUserSettings().lastCompletedDay
}

export function setLastCompletedDay(day: DayNumber): void {
  updateUserSettings({ lastCompletedDay: day })
}

// Exercise Weights
export function getExerciseWeights(): ExerciseWeights {
  return getFromStorage<ExerciseWeights>(STORAGE_KEYS.EXERCISE_WEIGHTS, {})
}

export function getExerciseWeight(exerciseName: string): number {
  const weights = getExerciseWeights()
  return weights[exerciseName] || 0
}

export function setExerciseWeight(exerciseName: string, weight: number): void {
  const weights = getExerciseWeights()
  weights[exerciseName] = weight
  setToStorage(STORAGE_KEYS.EXERCISE_WEIGHTS, weights)
  // Sync to Firestore
  syncToFirestoreIfLoggedIn(saveWeightsToFirestore, weights)
}

// Generate unique ID for workouts
export function generateWorkoutId(): string {
  return `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
