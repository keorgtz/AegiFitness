import { useCallback, useEffect, useState } from "react";
import { mealLogApi, mealPlanApi } from "../api/resources";
import { foodCatalogApi } from "../api/resources";
import { Button, Card, EmptyState, ErrorState, FoodSwapModal, Loading, Modal } from "../components/ui";
import { MacroBar } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { CatalogObjective, FoodDto, MealPlanDto, MealPlanItemDto } from "../types/api";
import { addDays, mealTypeName, today } from "../utils/format";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
const OBJECTIVES: CatalogObjective[] = ["Bulk", "Cut", "Both"];

export default function NutritionPage() {
  const toast = useToastCtx();
  const [date, setDate] = useState(today());
  const [selectedFood, setSelectedFood] = useState<FoodDto | null>(null);
  const [swapItem, setSwapItem] = useState<MealPlanItemDto | null>(null);

  const { data, loading, error, run } = useAsync<{
    plan: MealPlanDto;
    logs: Awaited<ReturnType<typeof mealLogApi.get>>;
  }>();

  const load = useCallback(() => {
    const from = addDays(date, -30);
    void run(
      Promise.all([mealPlanApi.forDate(date), mealLogApi.get(from, today())]).then(
        ([plan, logs]) => ({ plan, logs }),
      ),
    );
  }, [date, run]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegenerate = async () => {
    try {
      await mealPlanApi.regenerate(date);
      toast.add("Plan regenerado", "success");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al regenerar";
      toast.add(message, "error");
    }
  };

  if (loading && !data) return <Loading message="Cargando nutrición" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="restaurant" title="Sin datos" />;

  const plan = data.plan;
  const logged =
    data.logs.find((l) => l.date === date)?.entries ?? [];
  const loggedTotals = logged.reduce(
    (acc, e) => {
      acc.calories += e.calories;
      acc.protein += e.proteinG;
      return acc;
    },
    { calories: 0, protein: 0 },
  );

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">restaurant</span>
          <span>Nutrición</span>
        </div>
        <h1 className="hero__title">Plan de alimentación</h1>
      </div>

      <div className="section-title">
        <span>Fecha</span>
        <div className="row gap-2">
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button variant="ghost" size="sm" onClick={() => void handleRegenerate()}>
            Regenerar
          </Button>
        </div>
      </div>

      <Card title="Totales del día" icon="monitoring" style={{ marginBottom: 16 }}>
        <MacroBar
          label="Kcal"
          current={loggedTotals.calories}
          target={plan.targetCalories}
          unit=""
        />
        <MacroBar
          label="Proteína"
          current={loggedTotals.protein}
          target={plan.targetProteinG}
          unit="g"
          color="success"
        />
        <div className="grid-2 mt-3">
          <div className="stat-card">
            <div className="stat-card__label">Carbohidratos</div>
            <div className="stat-card__value">{plan.targetCarbsG}g</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Grasas</div>
            <div className="stat-card__value">{plan.targetFatG}g</div>
          </div>
        </div>
      </Card>

      <div className="section-title">
        <span>Comidas del día</span>
      </div>
      {plan.items.length === 0 ? (
        <EmptyState icon="no_meals" title="Sin comidas" description="No hay comidas planificadas para este día." />
      ) : (
        plan.items.map((item) => (
          <Card key={item.id} className="meal-card">
            <div className="meal-card__top">
              <div className="meal-card__type">{mealTypeName(item.mealType)}</div>
              <div className="row gap-2">
                <button
                  type="button"
                  className="icon-action"
                  onClick={() => setSwapItem(item)}
                  aria-label={`Cambiar ${item.food.name}`}
                  title="Cambiar platillo"
                >
                  <span className="icon">swap_horiz</span>
                </button>
                <button
                  type="button"
                  className="icon-action"
                  onClick={() => setSelectedFood(item.food)}
                  aria-label={`Receta de ${item.food.name}`}
                  title="Ver receta"
                >
                  <span className="icon">menu_book</span>
                </button>
                <div className="badge badge--info">{item.eaten ? "Registrada" : "Pendiente"}</div>
              </div>
            </div>
            <button
              type="button"
              className="meal-card__name meal-card__name--btn"
              onClick={() => setSelectedFood(item.food)}
            >
              {item.food.name}
            </button>
            <div className="meal-card__macros" aria-label="Información nutricional">
              <span className="meal-card__macro">
                <strong>{Math.round(item.food.calories * item.servings)}</strong> kcal
              </span>
              <span className="meal-card__macro">
                <strong>{Math.round(item.food.proteinG * item.servings)}</strong>g P
              </span>
              <span className="meal-card__macro">
                <strong>{item.servings}</strong> porciones
              </span>
            </div>
          </Card>
        ))
      )}

      <FoodSwapModal item={swapItem} onClose={() => setSwapItem(null)} onSwapped={load} />

      <div className="section-title mt-4">
        <span>Explorar catálogo</span>
      </div>
      <FoodCatalogExplorer />

      <Modal
        open={!!selectedFood}
        onClose={() => setSelectedFood(null)}
        title={selectedFood?.name ?? "Receta"}
        wide
      >
        {selectedFood && (
          <>
            <div className="label mb-2">{mealTypeName(selectedFood.mealType)}</div>
            <div className="grid-4 mb-4">
              <div className="dialog__macro dialog__macro--cyan">
                <strong>{selectedFood.calories}</strong>
                <span>kcal</span>
              </div>
              <div className="dialog__macro dialog__macro--lime">
                <strong>{selectedFood.proteinG}g</strong>
                <span>Proteína</span>
              </div>
              <div className="dialog__macro dialog__macro--coral">
                <strong>{selectedFood.carbsG}g</strong>
                <span>Carbos</span>
              </div>
              <div className="dialog__macro dialog__macro--violet">
                <strong>{selectedFood.fatG}g</strong>
                <span>Grasas</span>
              </div>
            </div>
            <div className="dialog__description">{selectedFood.description}</div>
            <div className="section-title">Ingredientes</div>
            <ul className="dialog__ingredients">
              {selectedFood.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
            <div className="section-title mt-3">Preparación</div>
            <ol className="dialog__steps">
              {selectedFood.steps.map((step, i) => (
                <li key={i}>
                  <div className="dialog__step-num">{i + 1}</div>
                  <div className="dialog__step-text">{step}</div>
                </li>
              ))}
            </ol>
          </>
        )}
      </Modal>
    </div>
  );
}

function FoodCatalogExplorer() {
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<string>("");
  const [objective, setObjective] = useState<string>("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FoodDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    foodCatalogApi
      .search({ search, mealType, objective, page, pageSize })
      .then((r) => {
        setItems(r.items);
        setTotal(r.totalCount);
      })
      .finally(() => setLoading(false));
  }, [search, mealType, objective, page]);

  return (
    <div>
      <div className="catalog-picker__search">
        <span className="icon">search</span>
        <input
          className="input"
          placeholder="Buscar comida..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="row gap-2 mb-3">
        <select
          className="select"
          value={mealType}
          onChange={(e) => {
            setMealType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas las comidas</option>
          {MEAL_TYPES.map((mt) => (
            <option key={mt} value={mt}>
              {mealTypeName(mt)}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={objective}
          onChange={(e) => {
            setObjective(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los objetivos</option>
          {OBJECTIVES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <Loading message="Cargando catálogo" />
      ) : items.length === 0 ? (
        <EmptyState icon="search_off" title="Sin resultados" />
      ) : (
        <>
          {items.map((food) => (
            <div key={food.id} className="catalog-picker__item">
              <div className="catalog-picker__item-title">{food.name}</div>
              <div className="catalog-picker__item-meta">
                {food.calories} kcal · {food.proteinG}g P · {mealTypeName(food.mealType)}
              </div>
            </div>
          ))}
          <div className="catalog-picker__pagination">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
