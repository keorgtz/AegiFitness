import type { ExerciseDto, WorkoutLogEntryDto, WorkoutSetRequest } from "../types/api";
import { formatDate } from "./format";

export interface SessionExercise {
  exercise: ExerciseDto;
  planDayId?: number;
  isExtra: boolean;
  restSeconds: number;
  sets: WorkoutSetRequest[];
}
export interface SavedSession { date: string; startedAt: string; current: number; notes: string; exercises: SessionExercise[] }
export const sessionKey = (userId: string) => `aegi_training_session_v2:${userId}`;
export const manualKey = (userId: string, date: string) => `aegi_training_manual_v2:${userId}:${date}`;
export const LEGACY_SESSION_KEY = "aegi_active_training_v1";

export function readLegacySession(): SavedSession | null {
  const value = readDraft<SavedSession>(LEGACY_SESSION_KEY);
  if (!value?.exercises?.length || !value.exercises.every((item) => item.exercise && item.sets?.length) || !Number.isFinite(Date.parse(value.startedAt))) return null;
  return { ...value, date: formatDate(value.startedAt), current: Math.max(0, Math.min(value.current || 0, value.exercises.length - 1)) };
}

export function readDraft<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as T | null; }
  catch { return null; }
}

export function readSession(userId: string): SavedSession | null {
  const value = readDraft<SavedSession>(sessionKey(userId));
  if (!value?.date || !value.exercises?.length || !value.exercises.every((item) => item.exercise && item.sets?.length)) return null;
  return { ...value, current: Math.max(0, Math.min(value.current || 0, value.exercises.length - 1)) };
}

export function entrySets(entry: WorkoutLogEntryDto): WorkoutSetRequest[] {
  if (entry.sets?.length) return entry.sets.map((set) => ({ ...set }));
  return Array.from({ length: entry.actualSets ?? entry.plannedSets }, (_, index) => ({
    setNumber: index + 1, plannedReps: entry.plannedReps,
    actualReps: entry.actualReps ?? entry.plannedReps, actualWeightKg: entry.actualWeightKg ?? 0,
    completed: entry.completed,
  }));
}
