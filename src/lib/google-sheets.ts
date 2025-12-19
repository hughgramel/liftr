import { getStoredToken, getSpreadsheetId, storeSpreadsheetId } from './google-auth'
import type { WorkoutHistory, ExerciseLog } from '@/types/workout'

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// Sheet names
const WORKOUTS_SHEET = 'Workouts'
const EXERCISES_SHEET = 'Exercises'
const SETTINGS_SHEET = 'Settings'

interface SheetError {
  error: {
    code: number
    message: string
  }
}

// Helper to make authenticated requests
async function sheetsRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()

  if (!response.ok) {
    const error = data as SheetError
    throw new Error(error.error?.message || 'Sheets API error')
  }

  return data as T
}

// Create a new spreadsheet for LiftR
export async function createLiftRSpreadsheet(): Promise<string> {
  const response = await sheetsRequest<{ spreadsheetId: string }>(
    SHEETS_API_BASE,
    {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          title: 'LiftR Workout Data',
        },
        sheets: [
          {
            properties: { title: WORKOUTS_SHEET },
          },
          {
            properties: { title: EXERCISES_SHEET },
          },
          {
            properties: { title: SETTINGS_SHEET },
          },
        ],
      }),
    }
  )

  const spreadsheetId = response.spreadsheetId
  storeSpreadsheetId(spreadsheetId)

  // Initialize headers
  await initializeSheetHeaders(spreadsheetId)

  return spreadsheetId
}

// Initialize sheet headers
async function initializeSheetHeaders(spreadsheetId: string): Promise<void> {
  // Workouts sheet headers
  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${WORKOUTS_SHEET}!A1:F1?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [['ID', 'Date', 'Day Number', 'Day Name', 'Duration (sec)', 'Total Sets']],
      }),
    }
  )

  // Exercises sheet headers (individual set logs)
  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${EXERCISES_SHEET}!A1:H1?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [['Workout ID', 'Date', 'Exercise', 'Tier', 'Set Number', 'Reps', 'Weight (lbs)', 'Completed']],
      }),
    }
  )

  // Settings sheet headers
  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${SETTINGS_SHEET}!A1:B1?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [['Key', 'Value']],
      }),
    }
  )
}

// Get or create spreadsheet
// If firebaseSpreadsheetId is provided (from user's Firebase profile), use it if accessible
export async function getOrCreateSpreadsheet(firebaseSpreadsheetId?: string | null): Promise<string> {
  // First, check localStorage for an existing spreadsheet ID
  const localId = getSpreadsheetId()

  // Try localStorage ID first
  if (localId) {
    try {
      await sheetsRequest(`${SHEETS_API_BASE}/${localId}`)
      return localId
    } catch {
      console.log('Local spreadsheet not accessible')
    }
  }

  // If no local ID or it's not accessible, try the Firebase spreadsheet ID
  // This handles the case where user logs in on a new device
  if (firebaseSpreadsheetId) {
    try {
      await sheetsRequest(`${SHEETS_API_BASE}/${firebaseSpreadsheetId}`)
      // Store it locally so we don't need to check Firebase again
      storeSpreadsheetId(firebaseSpreadsheetId)
      console.log('Using existing spreadsheet from Firebase profile')
      return firebaseSpreadsheetId
    } catch {
      console.log('Firebase spreadsheet not accessible, creating new one')
    }
  }

  return createLiftRSpreadsheet()
}

// Append a workout to the Workouts sheet
export async function appendWorkout(workout: WorkoutHistory): Promise<void> {
  const spreadsheetId = await getOrCreateSpreadsheet()

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)

  // Append to Workouts sheet
  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${WORKOUTS_SHEET}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[
          workout.id,
          workout.date,
          workout.dayNumber,
          workout.dayName,
          workout.duration,
          totalSets,
        ]],
      }),
    }
  )

  // Append individual exercise sets to Exercises sheet
  const exerciseRows: (string | number | boolean)[][] = []

  workout.exercises.forEach((exercise: ExerciseLog) => {
    exercise.sets.forEach((set, setIndex) => {
      if (set.completed) {
        exerciseRows.push([
          workout.id,
          workout.date,
          exercise.name,
          exercise.tier,
          setIndex + 1,
          set.actualReps,
          set.weight,
          true,
        ])
      }
    })
  })

  if (exerciseRows.length > 0) {
    await sheetsRequest(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${EXERCISES_SHEET}!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        body: JSON.stringify({
          values: exerciseRows,
        }),
      }
    )
  }
}

// Get all workouts from Sheets
export async function getWorkoutsFromSheets(): Promise<WorkoutHistory[]> {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) return []

  try {
    // Get workout summary data
    const workoutsResponse = await sheetsRequest<{ values?: string[][] }>(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${WORKOUTS_SHEET}!A2:F1000`
    )

    // Get exercise data
    const exercisesResponse = await sheetsRequest<{ values?: string[][] }>(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${EXERCISES_SHEET}!A2:H10000`
    )

    const workoutRows = workoutsResponse.values || []
    const exerciseRows = exercisesResponse.values || []

    // Group exercises by workout ID
    const exercisesByWorkout = new Map<string, ExerciseLog[]>()

    exerciseRows.forEach(row => {
      const [workoutId, , exerciseName, tier, setNumber, reps, weight, completed] = row
      if (!workoutId || !exerciseName) return

      if (!exercisesByWorkout.has(workoutId)) {
        exercisesByWorkout.set(workoutId, [])
      }

      const exercises = exercisesByWorkout.get(workoutId)!
      let exercise = exercises.find(e => e.name === exerciseName)

      if (!exercise) {
        exercise = {
          name: exerciseName,
          tier: (tier || 'T3') as 'T1' | 'T2' | 'T3',
          sets: [],
        }
        exercises.push(exercise)
      }

      exercise.sets.push({
        setNumber: parseInt(setNumber || '0'),
        targetReps: parseInt(reps || '0'),
        actualReps: parseInt(reps || '0'),
        weight: parseFloat(weight || '0'),
        completed: completed === 'TRUE' || completed === 'true',
      })
    })

    // Build workout history objects
    const workouts: WorkoutHistory[] = workoutRows
      .filter(row => row[0] && row[1] && row[2] && row[3])
      .map(row => {
        const [id, date, dayNumber, dayName, duration] = row
        return {
          id: id!,
          date: date!,
          dayNumber: parseInt(dayNumber!) as 1 | 2 | 3 | 4,
          dayName: dayName!,
          duration: parseInt(duration || '0'),
          exercises: exercisesByWorkout.get(id!) || [],
        }
      })

    return workouts.reverse() // Most recent first
  } catch (error) {
    console.error('Error fetching workouts from Sheets:', error)
    return []
  }
}

// Save exercise default weight to Settings sheet
export async function saveExerciseWeightToSheets(exerciseName: string, weight: number): Promise<void> {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) return

  try {
    // Get current settings
    const response = await sheetsRequest<{ values?: string[][] }>(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${SETTINGS_SHEET}!A2:B100`
    )

    const rows = response.values || []
    const key = `weight_${exerciseName}`
    const existingRowIndex = rows.findIndex(row => row[0] === key)

    if (existingRowIndex >= 0) {
      // Update existing row
      await sheetsRequest(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${SETTINGS_SHEET}!B${existingRowIndex + 2}?valueInputOption=RAW`,
        {
          method: 'PUT',
          body: JSON.stringify({
            values: [[weight.toString()]],
          }),
        }
      )
    } else {
      // Append new row
      await sheetsRequest(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${SETTINGS_SHEET}!A:B:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          body: JSON.stringify({
            values: [[key, weight.toString()]],
          }),
        }
      )
    }
  } catch (error) {
    console.error('Error saving weight to Sheets:', error)
  }
}

// Get exercise weights from Settings sheet
export async function getExerciseWeightsFromSheets(): Promise<Record<string, number>> {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) return {}

  try {
    const response = await sheetsRequest<{ values?: string[][] }>(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${SETTINGS_SHEET}!A2:B100`
    )

    const rows = response.values || []
    const weights: Record<string, number> = {}

    rows.forEach(row => {
      const [key, value] = row
      if (key?.startsWith('weight_')) {
        const exerciseName = key.replace('weight_', '')
        weights[exerciseName] = parseFloat(value || '0') || 0
      }
    })

    return weights
  } catch (error) {
    console.error('Error fetching weights from Sheets:', error)
    return {}
  }
}

// Check if connected to Google Sheets
export function isConnectedToSheets(): boolean {
  return !!getStoredToken() && !!getSpreadsheetId()
}

// Verify a spreadsheet ID is accessible
export async function verifySpreadsheetAccess(spreadsheetId: string): Promise<boolean> {
  try {
    await sheetsRequest(`${SHEETS_API_BASE}/${spreadsheetId}`)
    return true
  } catch {
    return false
  }
}

// Reset spreadsheet - creates a new one and populates with provided workout history
export async function resetAndPopulateSpreadsheet(workoutHistory: WorkoutHistory[]): Promise<string> {
  // Create a fresh spreadsheet
  const newSpreadsheetId = await createLiftRSpreadsheet()

  // If no workout history, just return the new empty spreadsheet
  if (!workoutHistory || workoutHistory.length === 0) {
    return newSpreadsheetId
  }

  // Populate with all workout data
  const workoutRows: (string | number)[][] = []
  const exerciseRows: (string | number | boolean)[][] = []

  workoutHistory.forEach(workout => {
    const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)

    workoutRows.push([
      workout.id,
      workout.date,
      workout.dayNumber,
      workout.dayName,
      workout.duration,
      totalSets,
    ])

    workout.exercises.forEach(exercise => {
      exercise.sets.forEach((set, setIndex) => {
        if (set.completed) {
          exerciseRows.push([
            workout.id,
            workout.date,
            exercise.name,
            exercise.tier,
            setIndex + 1,
            set.actualReps,
            set.weight,
            true,
          ])
        }
      })
    })
  })

  // Batch append workouts
  if (workoutRows.length > 0) {
    await sheetsRequest(
      `${SHEETS_API_BASE}/${newSpreadsheetId}/values/${WORKOUTS_SHEET}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        body: JSON.stringify({ values: workoutRows }),
      }
    )
  }

  // Batch append exercises
  if (exerciseRows.length > 0) {
    await sheetsRequest(
      `${SHEETS_API_BASE}/${newSpreadsheetId}/values/${EXERCISES_SHEET}!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        body: JSON.stringify({ values: exerciseRows }),
      }
    )
  }

  return newSpreadsheetId
}

// Sheet name for charts/dashboard
const DASHBOARD_SHEET = 'Dashboard'

// Get sheet ID by name
async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number | null> {
  const response = await sheetsRequest<{ sheets: Array<{ properties: { sheetId: number; title: string } }> }>(
    `${SHEETS_API_BASE}/${spreadsheetId}`
  )
  const sheet = response.sheets.find(s => s.properties.title === sheetName)
  return sheet?.properties.sheetId ?? null
}

// Delete a sheet by ID
async function deleteSheetIfExists(spreadsheetId: string, sheetName: string): Promise<void> {
  const sheetId = await getSheetId(spreadsheetId, sheetName)
  if (sheetId !== null) {
    try {
      await sheetsRequest(
        `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [{
              deleteSheet: { sheetId }
            }]
          })
        }
      )
      console.log(`[Sheets] Deleted sheet: ${sheetName}`)
    } catch (error) {
      console.warn(`[Sheets] Could not delete sheet ${sheetName}:`, error)
    }
  }
}

// Create Dashboard sheet (delete existing first)
async function createDashboardSheet(spreadsheetId: string): Promise<number> {
  // Delete existing dashboard sheet first
  await deleteSheetIfExists(spreadsheetId, DASHBOARD_SHEET)

  // Create new Dashboard sheet
  const response = await sheetsRequest<{ replies: Array<{ addSheet: { properties: { sheetId: number } } }> }>(
    `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: DASHBOARD_SHEET,
              gridProperties: { rowCount: 200, columnCount: 30 }
            }
          }
        }]
      })
    }
  )
  const reply = response.replies[0]
  if (!reply?.addSheet?.properties?.sheetId) {
    throw new Error('Failed to create Dashboard sheet')
  }
  return reply.addSheet.properties.sheetId
}

// Sheet for exercise-specific data
const EXERCISE_STATS_SHEET = 'Exercise Stats'

// Create Exercise Stats sheet (delete existing first)
async function createExerciseStatsSheet(spreadsheetId: string): Promise<number> {
  // Delete existing sheet first
  await deleteSheetIfExists(spreadsheetId, EXERCISE_STATS_SHEET)

  const response = await sheetsRequest<{ replies: Array<{ addSheet: { properties: { sheetId: number } } }> }>(
    `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: EXERCISE_STATS_SHEET,
              gridProperties: { rowCount: 1000, columnCount: 50 }
            }
          }
        }]
      })
    }
  )
  const reply = response.replies[0]
  if (!reply?.addSheet?.properties?.sheetId) {
    throw new Error('Failed to create Exercise Stats sheet')
  }
  return reply.addSheet.properties.sheetId
}

// Get unique exercises from the Exercises sheet
async function getUniqueExercises(spreadsheetId: string): Promise<string[]> {
  const response = await sheetsRequest<{ values?: string[][] }>(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${EXERCISES_SHEET}!C2:C10000`
  )
  const exercises = response.values?.map(row => row[0]).filter((val): val is string => Boolean(val)) || []
  return [...new Set(exercises)]
}

// Helper to convert column number to letter (0 = A, 1 = B, etc.)
function colToLetter(col: number): string {
  let letter = ''
  let temp = col
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

// Generate all charts on the Dashboard sheet
export async function generateCharts(): Promise<void> {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) throw new Error('No spreadsheet connected')

  console.log('[Sheets] Generating charts - deleting old sheets first...')

  // Get sheet IDs we need
  const workoutsSheetId = await getSheetId(spreadsheetId, WORKOUTS_SHEET)
  const exercisesSheetId = await getSheetId(spreadsheetId, EXERCISES_SHEET)

  if (workoutsSheetId === null || exercisesSheetId === null) {
    throw new Error('Workouts or Exercises sheet not found')
  }

  // Create fresh sheets (this deletes existing ones)
  const dashboardSheetId = await createDashboardSheet(spreadsheetId)
  const exerciseStatsSheetId = await createExerciseStatsSheet(spreadsheetId)

  // Get unique exercises
  const exercises = await getUniqueExercises(spreadsheetId)
  console.log('[Sheets] Found exercises:', exercises)

  // Get all workout data
  const workoutsResponse = await sheetsRequest<{ values?: string[][] }>(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${WORKOUTS_SHEET}!A2:F1000`
  )
  const workoutRows = workoutsResponse.values || []
  const numWorkouts = workoutRows.length

  console.log('[Sheets] Found', numWorkouts, 'workouts')

  if (numWorkouts === 0) {
    // Just add a message if no workouts
    await sheetsRequest(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${DASHBOARD_SHEET}!A1:B3?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({
          values: [
            ['LiftR Dashboard', ''],
            ['', ''],
            ['No workouts recorded yet. Complete a workout to see charts!', ''],
          ]
        })
      }
    )
    console.log('[Sheets] No workouts to chart')
    return
  }

  // Build Exercise Stats sheet - write actual data, not formulas for better chart compatibility
  // First, get all exercise data
  const exercisesDataResponse = await sheetsRequest<{ values?: string[][] }>(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${EXERCISES_SHEET}!A2:H10000`
  )
  const exerciseData = exercisesDataResponse.values || []

  // Build a map: workoutId -> { date, totalVolume, totalReps, exerciseVolumes, exerciseReps }
  const workoutStats: Map<string, {
    date: string,
    totalVolume: number,
    totalReps: number,
    exerciseVolumes: Map<string, number>,
    exerciseReps: Map<string, number>
  }> = new Map()

  // Initialize from workout rows
  workoutRows.forEach(row => {
    const [workoutId, date] = row
    if (workoutId) {
      workoutStats.set(workoutId, {
        date: date || '',
        totalVolume: 0,
        totalReps: 0,
        exerciseVolumes: new Map(),
        exerciseReps: new Map()
      })
    }
  })

  // Aggregate exercise data
  exerciseData.forEach(row => {
    const [workoutId, , exerciseName, , , repsStr, weightStr] = row
    if (!workoutId || !exerciseName) return

    const reps = parseInt(repsStr || '0') || 0
    const weight = parseFloat(weightStr || '0') || 0
    const volume = reps * weight

    const stats = workoutStats.get(workoutId)
    if (stats) {
      stats.totalVolume += volume
      stats.totalReps += reps
      stats.exerciseVolumes.set(exerciseName, (stats.exerciseVolumes.get(exerciseName) || 0) + volume)
      stats.exerciseReps.set(exerciseName, (stats.exerciseReps.get(exerciseName) || 0) + reps)
    }
  })

  // Build Exercise Stats sheet data
  const statsHeaders = ['Date', 'Total Volume', 'Total Reps']
  exercises.forEach(e => statsHeaders.push(`${e} Vol`))
  exercises.forEach(e => statsHeaders.push(`${e} Reps`))

  const statsData: (string | number)[][] = [statsHeaders]

  // Sort workouts by date
  const sortedWorkouts = Array.from(workoutStats.entries()).sort((a, b) => {
    return new Date(a[1].date).getTime() - new Date(b[1].date).getTime()
  })

  sortedWorkouts.forEach(([workoutId, stats]) => {
    const row: (string | number)[] = [
      stats.date ? new Date(stats.date).toLocaleDateString() : workoutId,
      Math.round(stats.totalVolume),
      stats.totalReps
    ]
    exercises.forEach(e => row.push(Math.round(stats.exerciseVolumes.get(e) || 0)))
    exercises.forEach(e => row.push(stats.exerciseReps.get(e) || 0))
    statsData.push(row)
  })

  // Write Exercise Stats data
  const endCol = colToLetter(statsHeaders.length - 1)
  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/'${EXERCISE_STATS_SHEET}'!A1:${endCol}${statsData.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: statsData })
    }
  )

  console.log('[Sheets] Wrote', statsData.length, 'rows to Exercise Stats')

  // Dashboard summary
  const totalVolume = Array.from(workoutStats.values()).reduce((sum, s) => sum + s.totalVolume, 0)
  const totalReps = Array.from(workoutStats.values()).reduce((sum, s) => sum + s.totalReps, 0)
  const totalSets = exerciseData.length

  // Count workouts by day
  const dayCount: [number, number, number, number] = [0, 0, 0, 0]
  workoutRows.forEach(row => {
    const dayNum = parseInt(row[2] || '0') || 0
    if (dayNum >= 1 && dayNum <= 4) {
      const idx = (dayNum - 1) as 0 | 1 | 2 | 3
      dayCount[idx]++
    }
  })

  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/'${DASHBOARD_SHEET}'!A1:B15?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [
          ['LiftR Dashboard', ''],
          ['', ''],
          ['Total Workouts', numWorkouts],
          ['Total Sets Completed', totalSets],
          ['Total Reps', totalReps],
          ['Total Weight Lifted (lbs)', Math.round(totalVolume)],
          ['', ''],
          ['Workouts by Day', ''],
          ['Day 1', dayCount[0]],
          ['Day 2', dayCount[1]],
          ['Day 3', dayCount[2]],
          ['Day 4', dayCount[3]],
          ['', ''],
          ['Individual exercise charts below', ''],
          ['Data in "Exercise Stats" sheet', ''],
        ]
      })
    }
  )

  // Now create charts
  const chartRequests: object[] = []
  const dataRowCount = statsData.length // includes header

  // Chart 1: Total Volume Per Workout
  chartRequests.push({
    addChart: {
      chart: {
        spec: {
          title: 'Total Volume Per Workout (lbs)',
          basicChart: {
            chartType: 'COLUMN',
            legendPosition: 'NO_LEGEND',
            axis: [
              { position: 'BOTTOM_AXIS', title: 'Date' },
              { position: 'LEFT_AXIS', title: 'Volume (lbs)' }
            ],
            domains: [{
              domain: {
                sourceRange: {
                  sources: [{
                    sheetId: exerciseStatsSheetId,
                    startRowIndex: 0,
                    endRowIndex: dataRowCount,
                    startColumnIndex: 0,
                    endColumnIndex: 1
                  }]
                }
              }
            }],
            series: [{
              series: {
                sourceRange: {
                  sources: [{
                    sheetId: exerciseStatsSheetId,
                    startRowIndex: 0,
                    endRowIndex: dataRowCount,
                    startColumnIndex: 1,
                    endColumnIndex: 2
                  }]
                }
              },
              targetAxis: 'LEFT_AXIS'
            }],
            headerCount: 1
          }
        },
        position: {
          overlayPosition: {
            anchorCell: { sheetId: dashboardSheetId, rowIndex: 0, columnIndex: 3 },
            widthPixels: 500,
            heightPixels: 300
          }
        }
      }
    }
  })

  // Chart 2: Total Reps Per Workout
  chartRequests.push({
    addChart: {
      chart: {
        spec: {
          title: 'Total Reps Per Workout',
          basicChart: {
            chartType: 'COLUMN',
            legendPosition: 'NO_LEGEND',
            axis: [
              { position: 'BOTTOM_AXIS', title: 'Date' },
              { position: 'LEFT_AXIS', title: 'Reps' }
            ],
            domains: [{
              domain: {
                sourceRange: {
                  sources: [{
                    sheetId: exerciseStatsSheetId,
                    startRowIndex: 0,
                    endRowIndex: dataRowCount,
                    startColumnIndex: 0,
                    endColumnIndex: 1
                  }]
                }
              }
            }],
            series: [{
              series: {
                sourceRange: {
                  sources: [{
                    sheetId: exerciseStatsSheetId,
                    startRowIndex: 0,
                    endRowIndex: dataRowCount,
                    startColumnIndex: 2,
                    endColumnIndex: 3
                  }]
                }
              },
              targetAxis: 'LEFT_AXIS'
            }],
            headerCount: 1
          }
        },
        position: {
          overlayPosition: {
            anchorCell: { sheetId: dashboardSheetId, rowIndex: 0, columnIndex: 11 },
            widthPixels: 500,
            heightPixels: 300
          }
        }
      }
    }
  })

  // Add individual charts for each exercise (volume over time)
  exercises.forEach((exercise, idx) => {
    const row = Math.floor(idx / 3) * 16 + 17 // New row every 3 charts
    const col = (idx % 3) * 8 // 8 columns apart

    // Volume column for this exercise starts at column 3 (0-indexed)
    const volColIndex = 3 + idx

    chartRequests.push({
      addChart: {
        chart: {
          spec: {
            title: `${exercise} - Volume (lbs)`,
            basicChart: {
              chartType: 'LINE',
              legendPosition: 'NO_LEGEND',
              axis: [
                { position: 'BOTTOM_AXIS', title: 'Date' },
                { position: 'LEFT_AXIS', title: 'Volume (lbs)' }
              ],
              domains: [{
                domain: {
                  sourceRange: {
                    sources: [{
                      sheetId: exerciseStatsSheetId,
                      startRowIndex: 0,
                      endRowIndex: dataRowCount,
                      startColumnIndex: 0,
                      endColumnIndex: 1
                    }]
                  }
                }
              }],
              series: [{
                series: {
                  sourceRange: {
                    sources: [{
                      sheetId: exerciseStatsSheetId,
                      startRowIndex: 0,
                      endRowIndex: dataRowCount,
                      startColumnIndex: volColIndex,
                      endColumnIndex: volColIndex + 1
                    }]
                  }
                },
                targetAxis: 'LEFT_AXIS'
              }],
              headerCount: 1
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId: dashboardSheetId, rowIndex: row, columnIndex: col },
              widthPixels: 450,
              heightPixels: 250
            }
          }
        }
      }
    })
  })

  // Execute all chart requests
  if (chartRequests.length > 0) {
    await sheetsRequest(
      `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests: chartRequests })
      }
    )
  }

  console.log('[Sheets] Charts generated successfully! Created', chartRequests.length, 'charts for', exercises.length, 'exercises')
}

// Update charts after workout completion - regenerate with new data
export async function updateChartsAfterWorkout(): Promise<void> {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) return

  // Always regenerate charts to include new workout data
  // This deletes old Dashboard/Exercise Stats and creates fresh ones
  try {
    await generateCharts()
    console.log('[Sheets] Charts updated after workout')
  } catch (error) {
    console.error('[Sheets] Failed to update charts after workout:', error)
    // Don't throw - workout data is already saved, just charts failed
  }
}
