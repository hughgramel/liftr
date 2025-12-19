import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { WorkoutHistory, UserSettings, ExerciseWeights, DayNumber } from '@/types/workout'

// Collection references
const getWorkoutsRef = (userId: string) => collection(db, 'users', userId, 'workouts')
const getSettingsRef = (userId: string) => doc(db, 'users', userId, 'settings', 'preferences')
const getWeightsRef = (userId: string) => doc(db, 'users', userId, 'settings', 'weights')

// Workout History
export async function saveWorkoutToFirestore(userId: string, workout: WorkoutHistory): Promise<void> {
  const workoutRef = doc(getWorkoutsRef(userId), workout.id)
  await setDoc(workoutRef, {
    ...workout,
    savedAt: serverTimestamp()
  })
}

export async function getWorkoutsFromFirestore(userId: string, limitCount: number = 50): Promise<WorkoutHistory[]> {
  const workoutsQuery = query(
    getWorkoutsRef(userId),
    orderBy('date', 'desc'),
    limit(limitCount)
  )
  const snapshot = await getDocs(workoutsQuery)
  return snapshot.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      date: data.date,
      dayNumber: data.dayNumber,
      dayName: data.dayName,
      duration: data.duration,
      exercises: data.exercises
    } as WorkoutHistory
  })
}

// User Settings
export async function saveSettingsToFirestore(userId: string, settings: UserSettings): Promise<void> {
  await setDoc(getSettingsRef(userId), {
    ...settings,
    updatedAt: serverTimestamp()
  })
}

export async function getSettingsFromFirestore(userId: string): Promise<UserSettings | null> {
  const settingsSnap = await getDoc(getSettingsRef(userId))
  if (!settingsSnap.exists()) return null

  const data = settingsSnap.data()
  return {
    restTimerSeconds: data.restTimerSeconds,
    timePerRepSeconds: data.timePerRepSeconds,
    lastCompletedDay: data.lastCompletedDay
  }
}

// Exercise Weights
export async function saveWeightsToFirestore(userId: string, weights: ExerciseWeights): Promise<void> {
  await setDoc(getWeightsRef(userId), {
    weights,
    updatedAt: serverTimestamp()
  })
}

export async function getWeightsFromFirestore(userId: string): Promise<ExerciseWeights | null> {
  const weightsSnap = await getDoc(getWeightsRef(userId))
  if (!weightsSnap.exists()) return null
  return weightsSnap.data().weights || {}
}

// Sync local storage to Firestore
export async function syncLocalToFirestore(userId: string): Promise<void> {
  // Get local data
  const localWorkouts = JSON.parse(localStorage.getItem('liftr_workout_history') || '[]')
  const localSettings = JSON.parse(localStorage.getItem('liftr_user_settings') || '{}')
  const localWeights = JSON.parse(localStorage.getItem('liftr_exercise_weights') || '{}')

  // Sync workouts
  for (const workout of localWorkouts) {
    await saveWorkoutToFirestore(userId, workout)
  }

  // Sync settings if they exist
  if (Object.keys(localSettings).length > 0) {
    await saveSettingsToFirestore(userId, localSettings)
  }

  // Sync weights if they exist
  if (Object.keys(localWeights).length > 0) {
    await saveWeightsToFirestore(userId, localWeights)
  }
}

// Sync Firestore to local storage
export async function syncFirestoreToLocal(userId: string): Promise<void> {
  // Get Firestore data
  const workouts = await getWorkoutsFromFirestore(userId)
  const settings = await getSettingsFromFirestore(userId)
  const weights = await getWeightsFromFirestore(userId)

  // Merge with local - Firestore takes precedence for conflicts
  if (workouts.length > 0) {
    const localWorkouts = JSON.parse(localStorage.getItem('liftr_workout_history') || '[]')
    const existingIds = new Set(workouts.map(w => w.id))

    // Add any local workouts that aren't in Firestore
    const mergedWorkouts = [...workouts]
    for (const localWorkout of localWorkouts) {
      if (!existingIds.has(localWorkout.id)) {
        mergedWorkouts.push(localWorkout)
        // Also save to Firestore
        await saveWorkoutToFirestore(userId, localWorkout)
      }
    }

    // Sort by date descending
    mergedWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    localStorage.setItem('liftr_workout_history', JSON.stringify(mergedWorkouts))
  }

  if (settings) {
    localStorage.setItem('liftr_user_settings', JSON.stringify(settings))
  }

  if (weights) {
    localStorage.setItem('liftr_exercise_weights', JSON.stringify(weights))
  }
}

// Analytics data
export interface WorkoutStats {
  totalWorkouts: number
  totalDuration: number // in seconds
  totalSets: number
  totalReps: number
  workoutsByDay: Record<DayNumber, number>
  workoutsByMonth: Record<string, number>
  averageDuration: number
  streakDays: number
  exerciseStats: Record<string, {
    totalSets: number
    totalReps: number
    maxWeight: number
    lastWeight: number
  }>
}

export async function calculateWorkoutStats(userId: string): Promise<WorkoutStats> {
  const workouts = await getWorkoutsFromFirestore(userId, 500)

  const stats: WorkoutStats = {
    totalWorkouts: workouts.length,
    totalDuration: 0,
    totalSets: 0,
    totalReps: 0,
    workoutsByDay: { 1: 0, 2: 0, 3: 0, 4: 0 },
    workoutsByMonth: {},
    averageDuration: 0,
    streakDays: 0,
    exerciseStats: {}
  }

  if (workouts.length === 0) return stats

  // Calculate streak
  const sortedDates = workouts
    .map(w => new Date(w.date).toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  let streak = 0
  const today = new Date()
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date(today)
    expectedDate.setDate(today.getDate() - i)
    if (sortedDates[i] === expectedDate.toDateString()) {
      streak++
    } else {
      break
    }
  }
  stats.streakDays = streak

  // Process workouts
  for (const workout of workouts) {
    stats.totalDuration += workout.duration
    stats.workoutsByDay[workout.dayNumber]++

    const month = workout.date.substring(0, 7) // YYYY-MM
    stats.workoutsByMonth[month] = (stats.workoutsByMonth[month] || 0) + 1

    for (const exercise of workout.exercises) {
      if (!stats.exerciseStats[exercise.name]) {
        stats.exerciseStats[exercise.name] = {
          totalSets: 0,
          totalReps: 0,
          maxWeight: 0,
          lastWeight: 0
        }
      }

      const exerciseStat = stats.exerciseStats[exercise.name]
      if (!exerciseStat) continue

      for (const set of exercise.sets) {
        if (set.completed) {
          stats.totalSets++
          stats.totalReps += set.actualReps
          exerciseStat.totalSets++
          exerciseStat.totalReps += set.actualReps
          exerciseStat.maxWeight = Math.max(exerciseStat.maxWeight, set.weight)
        }
      }

      // Get last weight from most recent workout
      const lastSet = exercise.sets.find(s => s.completed)
      if (lastSet) {
        exerciseStat.lastWeight = lastSet.weight
      }
    }
  }

  stats.averageDuration = Math.round(stats.totalDuration / workouts.length)

  return stats
}
