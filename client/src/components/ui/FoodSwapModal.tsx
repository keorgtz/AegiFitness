import { useEffect, useState } from "react";
import { foodCatalogApi, mealPlanApi } from "../../api/resources";
import { useToastCtx } from "../../hooks/useToastContext";
import type { FoodDto, MealPlanItemDto, MealType } from "../../types/api";
import { mealTypeName } from "../../utils/format";
import { EmptyState, Loading, Modal } from "./index";

// Acento por tipo de comida (tokens semánticos existentes, sin colores nuevos)
const MEAL_VARIANT: Record<MealType, string> = {
  Breakfast: "warning",
  Lunch: "success",
  Dinner: "info",
  Snack: "accent",
};

interface FoodSwapModalProps {
  item: MealPlanItemDto | null;
  onClose: () => void;
  onSwapped: () => void;
}

// El plan de comidas es recomendación: permite cambiar un platillo por otro
// del catálogo (mismo tipo de comida por defecto, proteína similar primero)
// y persiste el cambio en el plan del día vía API.
export function FoodSwapModal({ item, onClose, onSwapped }: FoodSwapModalProps) {
  const toast = useToastCtx();
  const [items, setItems] = useState<FoodDto[]>([]);
  const [search, setSearch] = useState("");
  const [sameType, setSameType] = useState(true);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    if (!item) return;
    setSearch("");
    setSameType(true);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    foodCatalogApi
      .search({
        search,
        mealType: sameType ? item.mealType : undefined,
        pageSize: 20,
      })
      .then((r) => {
        // Excluir el platillo actual y deduplicar por nombre (el seed repite
        // nombres con distinto objetivo); ordenar por proteína más cercana.
        const seen = new Set<string>();
        const target = item.food.proteinG;
        setItems(
          r.items
            .filter((f) => {
              if (f.id === item.foodId || seen.has(f.name)) return false;
              seen.add(f.name);
              return true;
            })
            .sort((a, b) => Math.abs(a.proteinG - target) - Math.abs(b.proteinG - target)),
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, search, sameType]);

  if (!item) return null;
  const variant = MEAL_VARIANT[item.mealType];

  const select = async (food: FoodDto) => {
    setSwapping(true);
    try {
      await mealPlanApi.swapItem(item.id, food.id);
      toast.add(`Cambiado a ${food.name}`, "success");
      onSwapped();
      onClose();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al cambiar platillo";
      toast.add(message, "error");
    } finally {
      setSwapping(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Cambiar platillo">
      <div className="swap-modal__current">
        <span className="label">Sustituyendo</span>
        <div className="swap-modal__current-name">{item.food.name}</div>
        <div className="swap-modal__current-meta">
          {Math.round(item.food.calories * item.servings)} kcal ·{" "}
          {Math.round(item.food.proteinG * item.servings)}g proteína
        </div>
        <div className="row gap-2 mt-2" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            className={`muscle-tag muscle-tag--${variant} muscle-tag--btn ${sameType ? "" : "muscle-tag--off"}`}
            onClick={() => setSameType((v) => !v)}
            title={
              sameType
                ? "Mostrando solo este tipo de comida (clic para ver todos)"
                : "Mostrando todos los tipos"
            }
          >
            {mealTypeName(item.mealType)}
          </button>
          <span className="muscle-tag muscle-tag--info">Proteína similar primero</span>
        </div>
      </div>
      <div className="catalog-picker__search">
        <span className="icon">search</span>
        <input
          className="input"
          placeholder="Buscar sustituto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <Loading message="Buscando..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="restaurant"
          title="Sin alternativas"
          description="No hay otros platillos con estos filtros. Desactiva el filtro de tipo para ver más."
        />
      ) : (
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {items.map((food) => (
            <button
              key={food.id}
              type="button"
              className="catalog-picker__item"
              disabled={swapping}
              onClick={() => void select(food)}
            >
              <div className="catalog-picker__item-title">{food.name}</div>
              <div className="catalog-picker__item-meta">
                {food.calories} kcal · {food.proteinG}g P · {food.carbsG}g C · {food.fatG}g G ·{" "}
                {mealTypeName(food.mealType)}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
