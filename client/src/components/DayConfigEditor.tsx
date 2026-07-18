import { Chip, Select } from "./ui";
import type { Modality, MuscleGroup, TrainingDayConfigDto } from "../types/api";
import { dayName, modalityName, muscleGroupName } from "../utils/format";

const MODALITIES: Modality[] = ["Rest", "Gym", "Calisthenics", "Both"];
const MUSCLES: MuscleGroup[] = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Core",
];

interface DayConfigEditorProps {
  days: TrainingDayConfigDto[];
  onChange: (days: TrainingDayConfigDto[]) => void;
}

export function DayConfigEditor({ days, onChange }: DayConfigEditorProps) {
  const today = new Date().getDay();

  const updateDay = (index: number, patch: Partial<TrainingDayConfigDto>) => {
    const next = days.map((d, i) => (i === index ? { ...d, ...patch } : d));
    onChange(next);
  };

  const toggleMuscle = (index: number, muscle: MuscleGroup) => {
    const day = days[index];
    if (!day) return;
    const has = day.muscleGroups.includes(muscle);
    const nextMuscles = has
      ? day.muscleGroups.filter((m) => m !== muscle)
      : [...day.muscleGroups, muscle];
    updateDay(index, { muscleGroups: nextMuscles });
  };

  return (
    <div className="training-split">
      {days.map((day, index) => {
        const isTraining = day.modality !== "Rest";
        return (
          <div
            key={day.dayOfWeek}
            className={`day-config ${day.dayOfWeek === today ? "day-config--today" : ""}`}
          >
            <div className="day-config__head">
              <div className="day-config__name">
                {dayName(day.dayOfWeek)}
                {day.dayOfWeek === today && (
                  <span className="badge badge--info">Hoy</span>
                )}
              </div>
              <Select
                value={day.modality}
                onChange={(e) => updateDay(index, { modality: e.target.value as Modality })}
                options={MODALITIES.map((m) => ({ value: m, label: modalityName(m) }))}
              />
            </div>
            {isTraining && (
              <div className="day-config__chips">
                {MUSCLES.map((muscle) => (
                  <Chip
                    key={muscle}
                    small
                    active={day.muscleGroups.includes(muscle)}
                    onClick={() => toggleMuscle(index, muscle)}
                  >
                    {muscleGroupName(muscle)}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
