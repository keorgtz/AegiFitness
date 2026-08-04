import { useState } from "react";
import type { ExerciseDto, FoodDto } from "../../types/api";
import { Chip, Modal } from "./index";
import { exerciseImageUrl, exerciseImageVariants, muscleGroupName, modalityName } from "../../utils/format";

const VARIANT_LABEL: Record<string, string> = {
  start: "Inicio",
  peak: "Pico del movimiento",
  main: "Postura",
};

interface ExerciseGuideModalProps {
  exercise: ExerciseDto | null;
  onClose: () => void;
}

export function ExerciseGuideModal({ exercise, onClose }: ExerciseGuideModalProps) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  if (!exercise) return null;

  const difficultyLabel = exercise.difficulty === 1 ? "Fácil" : exercise.difficulty === 2 ? "Media" : "Difícil";
  // Variantes con imagen real; las que fallen al cargar se ocultan solas
  const variants = exerciseImageVariants(exercise).filter((v) => !failed.has(v));

  return (
    <Modal open onClose={onClose} title={exercise.name} wide>
      <div className="dialog__meta mb-4">
        <div className="day-config__chips">
          <Chip active>{muscleGroupName(exercise.muscleGroup)}</Chip>
          <Chip>{modalityName(exercise.type)}</Chip>
          <Chip>{exercise.equipment}</Chip>
          <Chip>
            {difficultyLabel} ({exercise.difficulty}/3)
          </Chip>
        </div>
      </div>

      {variants.length > 0 && (
        <div className={`guide-images ${variants.length > 1 ? "guide-images--pair" : ""}`}>
          {variants.map((v) => (
            <figure key={v} className="guide-images__figure">
              <img
                src={exerciseImageUrl(exercise, v) ?? undefined}
                alt={`${exercise.name} — ${VARIANT_LABEL[v] ?? v}`}
                loading="lazy"
                onError={() => setFailed((f) => new Set(f).add(v))}
              />
              <figcaption>{VARIANT_LABEL[v] ?? v}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="dialog__description">{exercise.description}</div>

      <div className="section-title">Instrucciones</div>
      <div className="dialog__instructions">
        <p style={{ lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-line" }}>
          {exercise.instructions}
        </p>
      </div>

      <div className="section-title">Músculos objetivo</div>
      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>{exercise.target}</p>

      <div className="section-title">Efecto</div>
      <p style={{ color: "var(--text-muted)", whiteSpace: "pre-line" }}>{exercise.effect}</p>

      {variants.length > 0 && (
        <div className="guide-attribution">
          Imágenes y datos de ejercicios por{" "}
          <a href="https://repdb.co/free-exercise-dataset" target="_blank" rel="noreferrer">
            RepDB (repdb.co)
          </a>
        </div>
      )}
    </Modal>
  );
}

interface RecipeModalProps {
  food: FoodDto | null;
  onClose: () => void;
}

export function RecipeModal({ food, onClose }: RecipeModalProps) {
  if (!food) return null;

  return (
    <Modal open onClose={onClose} title={food.name} wide>
      <div className="dialog__macros mb-4">
        <div className="dialog__macro dialog__macro--cyan">
          <strong>{food.calories}</strong>
          <span>kcal</span>
        </div>
        <div className="dialog__macro dialog__macro--lime">
          <strong>{food.proteinG}g</strong>
          <span>Proteína</span>
        </div>
        <div className="dialog__macro dialog__macro--coral">
          <strong>{food.carbsG}g</strong>
          <span>Carbos</span>
        </div>
        <div className="dialog__macro dialog__macro--violet">
          <strong>{food.fatG}g</strong>
          <span>Grasas</span>
        </div>
        <div className="dialog__macro dialog__macro--danger">
          <strong>{food.sugarsG}g</strong>
          <span>Azúcares</span>
        </div>
      </div>

      <div className="dialog__portions">{food.portions}</div>

      <div className="dialog__description">{food.description}</div>

      <div className="section-title">Ingredientes</div>
      <ul className="dialog__ingredients">
        {food.ingredients.map((ing, i) => (
          <li key={i}>{ing}</li>
        ))}
      </ul>

      <div className="section-title mt-3">Preparación</div>
      <ol className="dialog__steps">
        {food.steps.map((step, i) => (
          <li key={i}>
            <div className="dialog__step-num">{i + 1}</div>
            <div className="dialog__step-text">{step}</div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
