import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { foodCatalogApi, mealLogApi, mealPlanApi } from "../api/resources";
import { Button, Chip, EmptyState, ErrorState, FoodSwapModal, Loading, Modal, RecipeModal, SegmentedControl, Stepper } from "../components/ui";
import { MacroBar } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { CatalogObjective, FoodDto, MealLogEntryRequest, MealPlanItemDto, MealType } from "../types/api";
import { mealTypeName, today } from "../utils/format";

type NutritionView = "log" | "plan" | "catalog";
interface MealEntry { foodId?: number; customName?: string; mealType: MealType; servings: number; calories: number; proteinG: number; carbsG: number; fatG: number; isExtra: boolean; food?: FoodDto }
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
const OBJECTIVES: CatalogObjective[] = ["Bulk", "Cut", "Both"];
const FOOD_PAGE_SIZE = 24;

export default function NutritionPage() {
  const toast = useToastCtx();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<NutritionView>("log");
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [servings, setServings] = useState<Record<number, number>>({});
  const [selectedFood, setSelectedFood] = useState<FoodDto | null>(null);
  const [swapItem, setSwapItem] = useState<MealPlanItemDto | null>(null);
  const [foodPicker, setFoodPicker] = useState(false);
  const [quickEntry, setQuickEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { data, loading, error, run } = useAsync<{ plan: Awaited<ReturnType<typeof mealPlanApi.forDate>>; logs: Awaited<ReturnType<typeof mealLogApi.get>> }>();

  const load = useCallback(() => {
    void run(Promise.all([mealPlanApi.forDate(date), mealLogApi.get(date, date)]).then(([plan, logs]) => ({ plan, logs })));
  }, [date, run]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    if (searchParams.get("quick") !== "food") return;
    setView("log");
    setFoodPicker(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (!data) return;
    setEntries((data.logs.find((log) => log.date === date)?.entries ?? []).map((entry) => ({ ...entry })));
    setServings(Object.fromEntries(data.plan.items.map((item) => [item.id, item.servings])));
  }, [data, date]);

  const totals = useMemo(() => entries.reduce((sum, entry) => ({ calories: sum.calories + entry.calories, protein: sum.protein + entry.proteinG, carbs: sum.carbs + entry.carbsG, fat: sum.fat + entry.fatG }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [entries]);
  const updateEntry = (index: number, patch: Partial<MealEntry>) => setEntries((current) => current.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  const addFood = (food: FoodDto, mealType: MealType) => {
    setEntries((current) => [...current, { foodId: food.id, mealType, servings: 1, calories: food.calories, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, isExtra: true, food }]);
    setFoodPicker(false);
  };
  const addRecommended = (item: MealPlanItemDto) => {
    const quantity = servings[item.id] ?? item.servings;
    setEntries((current) => [...current, { foodId: item.foodId, mealType: item.mealType, servings: quantity, calories: Math.round(item.food.calories * quantity), proteinG: Math.round(item.food.proteinG * quantity), carbsG: Math.round(item.food.carbsG * quantity), fatG: Math.round(item.food.fatG * quantity), isExtra: false, food: item.food }]);
    setView("log");
    toast.add(`${item.food.name} añadido al registro`, "success");
  };
  const addQuick = (entry: Omit<MealEntry, "servings" | "isExtra">) => {
    setEntries((current) => [...current, { ...entry, servings: 1, isExtra: true }]);
    setQuickEntry(false);
  };

  const saveMeals = async () => {
    setSaving(true);
    try {
      await mealLogApi.log({ date, entries: entries.map(({ food: _food, ...entry }) => entry) satisfies MealLogEntryRequest[] });
      toast.add("Comidas guardadas", "success");
      load();
    } catch (err) { toast.add(err instanceof Error ? err.message : "No se pudieron guardar las comidas", "error"); }
    finally { setSaving(false); }
  };
  const regenerate = async () => {
    setRegenerating(true);
    try { await mealPlanApi.regenerate(date); toast.add("Plan de alimentación regenerado", "success"); load(); }
    catch (err) { toast.add(err instanceof Error ? err.message : "No se pudo regenerar el plan", "error"); }
    finally { setRegenerating(false); }
  };

  if (loading && !data) return <Loading message="Cargando nutrición" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="restaurant" title="Sin datos de nutrición" />;
  const plan = data.plan;

  return <div className="page">
    <div className="hero">
      <div className="hero__label"><span className="icon">restaurant</span><span>Nutrición</span></div>
      <h1 className="hero__title">Tu alimentación, sin salir de Nutrición</h1>
      <p className="hero__subtitle">Registra comidas, consulta el plan y encuentra alternativas desde este apartado.</p>
    </div>
    <div className="nutrition-toolbar"><label className="input-group__label" htmlFor="nutrition-date">Fecha</label><input id="nutrition-date" type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} /></div>
    <div className="mb-4"><SegmentedControl block value={view} onChange={setView} options={[{ value: "log", label: "Mi registro" }, { value: "plan", label: "Plan del día" }, { value: "catalog", label: "Catálogo" }]} /></div>

    {view === "log" && <section aria-labelledby="meal-log-title">
      <div className="section-title"><span id="meal-log-title">Comidas registradas</span><span className="section-title__hint">{entries.length} entradas</span></div>
      {!entries.length ? <EmptyState icon="restaurant" title="Aún no registraste comidas" description="Añade una comida del plan, del catálogo o crea una entrada rápida." action={<Button onClick={() => setView("plan")}>Ver plan del día</Button>} /> : entries.map((entry, index) => <div key={`${entry.foodId ?? entry.customName}-${index}`} className="meal-entry">
        <div className="meal-entry__head"><div><div className="meal-entry__name">{entry.food?.name ?? entry.customName ?? "Comida"}</div><div className="meal-entry__meta">{mealTypeName(entry.mealType)} · {entry.calories} kcal · {entry.proteinG}g P · {entry.carbsG}g C · {entry.fatG}g G</div></div><button type="button" className="btn-icon" onClick={() => setEntries((current) => current.filter((_, i) => i !== index))} aria-label={`Eliminar ${entry.food?.name ?? entry.customName ?? "comida"}`}><span className="icon">delete</span></button></div>
        <div className="meal-entry__row"><span className="label">Porciones</span><Stepper value={entry.servings} onChange={(value) => { const ratio = value / entry.servings; updateEntry(index, { servings: value, calories: Math.round(entry.calories * ratio), proteinG: Math.round(entry.proteinG * ratio), carbsG: Math.round(entry.carbsG * ratio), fatG: Math.round(entry.fatG * ratio) }); }} min={0.5} max={5} step={0.5} size="sm" /></div>
      </div>)}
      <div className="nutrition-actions"><Button variant="ghost" onClick={() => setFoodPicker(true)}>Añadir del catálogo</Button><Button variant="ghost" onClick={() => setQuickEntry(true)}>Entrada rápida</Button></div>
      <div className="card mt-3"><div className="card__title"><span className="icon">monitoring</span>Totales del día</div><MacroBar label="Kcal" current={totals.calories} target={plan.targetCalories} unit="" color="primary" /><MacroBar label="Proteína" current={totals.protein} target={plan.targetProteinG} unit="g" color="success" /><MacroBar label="Carbos" current={totals.carbs} target={plan.targetCarbsG} unit="g" color="danger" /><MacroBar label="Grasas" current={totals.fat} target={plan.targetFatG} unit="g" color="primary" /></div>
      <Button block loading={saving} onClick={() => void saveMeals()} className="mt-3">Guardar comidas</Button>
    </section>}

    {view === "plan" && <section aria-labelledby="meal-plan-title">
      <div className="section-title"><span id="meal-plan-title">Plan de alimentación</span><Button variant="ghost" size="sm" loading={regenerating} onClick={() => void regenerate()}>Regenerar</Button></div>
      {!plan.items.length ? <EmptyState icon="no_meals" title="Sin comidas planificadas" /> : plan.items.map((item) => { const quantity = servings[item.id] ?? item.servings; return <div key={item.id} className="meal-rec-card">
        <div className="meal-rec-card__head"><button type="button" className="meal-card__name meal-card__name--btn" onClick={() => setSelectedFood(item.food)}>{item.food.name}</button><Chip small>{mealTypeName(item.mealType)}</Chip></div>
        <div className="meal-rec-card__macros"><span><strong>{Math.round(item.food.calories * quantity)}</strong> kcal</span><span><strong>{Math.round(item.food.proteinG * quantity)}</strong>g P</span><span><strong>{Math.round(item.food.carbsG * quantity)}</strong>g C</span><span><strong>{Math.round(item.food.fatG * quantity)}</strong>g G</span></div>
        <div className="meal-rec-card__row"><Button size="sm" onClick={() => addRecommended(item)}>La comí</Button><button type="button" className="icon-action" onClick={() => setSwapItem(item)} aria-label={`Cambiar ${item.food.name}`} title="Cambiar platillo"><span className="icon">swap_horiz</span></button><button type="button" className="icon-action" onClick={() => setSelectedFood(item.food)} aria-label={`Receta de ${item.food.name}`} title="Ver receta"><span className="icon">menu_book</span></button><Stepper label="Porciones" value={quantity} onChange={(value) => setServings((current) => ({ ...current, [item.id]: value }))} min={0.5} max={5} step={0.5} size="sm" /></div>
      </div>; })}
    </section>}

    {view === "catalog" && <FoodCatalog onSelect={setSelectedFood} />}
    <FoodPickerModal open={foodPicker} onClose={() => setFoodPicker(false)} onSelect={addFood} onQuick={() => { setFoodPicker(false); setQuickEntry(true); }} />
    <QuickMealModal open={quickEntry} onClose={() => setQuickEntry(false)} onAdd={addQuick} />
    <FoodSwapModal item={swapItem} onClose={() => setSwapItem(null)} onSwapped={load} />
    <RecipeModal food={selectedFood} onClose={() => setSelectedFood(null)} />
  </div>;
}

function FoodCatalog({ onSelect }: { onSelect: (food: FoodDto) => void }) {
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState("");
  const [objective, setObjective] = useState("");
  const [items, setItems] = useState<FoodDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalCount / FOOD_PAGE_SIZE));
  useEffect(() => {
    let active = true;
    setLoading(true);
    foodCatalogApi.search({ search, mealType, objective, page, pageSize: FOOD_PAGE_SIZE }).then((result) => {
      if (!active) return;
      setItems(result.items);
      setTotalCount(result.totalCount);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, mealType, objective, page]);
  return <section aria-labelledby="food-catalog-title"><div className="section-title"><span id="food-catalog-title">Catálogo de comidas</span></div><div className="catalog-picker__search"><span className="icon">search</span><input className="input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar cualquier comida..." /></div><div className="catalog-picker__filters"><select className="select" value={mealType} onChange={(event) => { setMealType(event.target.value); setPage(1); }}><option value="">Todos los platillos</option>{MEAL_TYPES.map((type) => <option key={type} value={type}>{mealTypeName(type)}</option>)}</select><select className="select" value={objective} onChange={(event) => { setObjective(event.target.value); setPage(1); }}><option value="">Todos los objetivos</option>{OBJECTIVES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{loading ? <Loading message="Cargando catálogo" /> : !items.length ? <EmptyState icon="search_off" title="Sin resultados" /> : <>{items.map((food) => <button key={food.id} type="button" className="catalog-picker__item" onClick={() => onSelect(food)}><div><div className="catalog-picker__item-title">{food.name}</div><div className="catalog-picker__item-meta">{food.calories} kcal · {food.proteinG}g P · {mealTypeName(food.mealType)}</div></div><span className="icon">chevron_right</span></button>)}<div className="catalog-picker__pagination"><Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button><span className="text-muted">{totalCount} platillos · {page}/{totalPages}</span><Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button></div></>}</section>;
}

function FoodPickerModal({ open, onClose, onSelect, onQuick }: { open: boolean; onClose: () => void; onSelect: (food: FoodDto, mealType: MealType) => void; onQuick: () => void }) {
  const [filterMealType, setFilterMealType] = useState("");
  const [logMealType, setLogMealType] = useState<MealType | "auto">("auto");
  const [objective, setObjective] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<FoodDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalCount / FOOD_PAGE_SIZE));

  useEffect(() => {
    if (open) return;
    setFilterMealType("");
    setLogMealType("auto");
    setObjective("");
    setSearch("");
    setPage(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    foodCatalogApi.search({ search, mealType: filterMealType, objective, page, pageSize: FOOD_PAGE_SIZE }).then((result) => {
      if (!active) return;
      setItems(result.items);
      setTotalCount(result.totalCount);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, search, filterMealType, objective, page]);

  return <Modal open={open} onClose={onClose} title="Añadir comida" wide><div className="catalog-picker__filters catalog-picker__filters--triple"><div className="input-group"><label className="input-group__label">Mostrar</label><select className="select" value={filterMealType} onChange={(event) => { setFilterMealType(event.target.value); setPage(1); }}><option value="">Todos los platillos</option>{MEAL_TYPES.map((type) => <option key={type} value={type}>{mealTypeName(type)}</option>)}</select></div><div className="input-group"><label className="input-group__label">Objetivo</label><select className="select" value={objective} onChange={(event) => { setObjective(event.target.value); setPage(1); }}><option value="">Todos</option>{OBJECTIVES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="input-group"><label className="input-group__label">Registrar como</label><select className="select" value={logMealType} onChange={(event) => setLogMealType(event.target.value as MealType | "auto")}><option value="auto">Tipo del platillo</option>{MEAL_TYPES.map((type) => <option key={type} value={type}>{mealTypeName(type)}</option>)}</select></div></div><div className="catalog-picker__search"><span className="icon">search</span><input className="input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar cualquier comida..." /></div>{loading ? <Loading message="Buscando comidas" /> : !items.length ? <EmptyState icon="search_off" title="Sin resultados" description="Prueba quitando los filtros o cambiando la búsqueda." /> : <>{items.map((food) => <button key={food.id} type="button" className="catalog-picker__item" onClick={() => onSelect(food, logMealType === "auto" ? food.mealType : logMealType)}><div><div className="catalog-picker__item-title">{food.name}</div><div className="catalog-picker__item-meta">{food.calories} kcal · {food.proteinG}g P · {mealTypeName(food.mealType)}</div></div><span className="icon">add</span></button>)}<div className="catalog-picker__pagination"><Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button><span className="text-muted">{totalCount} platillos · {page}/{totalPages}</span><Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button></div></>}<Button variant="ghost" block className="mt-3" onClick={onQuick}>No está en el catálogo</Button></Modal>;
}

function QuickMealModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (entry: Omit<MealEntry, "servings" | "isExtra">) => void }) {
  const [name, setName] = useState(""); const [mealType, setMealType] = useState<MealType>("Snack"); const [calories, setCalories] = useState(0); const [proteinG, setProteinG] = useState(0); const [carbsG, setCarbsG] = useState(0); const [fatG, setFatG] = useState(0);
  return <Modal open={open} onClose={onClose} title="Entrada rápida"><div className="input-group"><label className="input-group__label">Nombre</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Lo que comiste" /></div><div className="input-group"><label className="input-group__label">Tipo</label><select className="select" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{MEAL_TYPES.map((type) => <option key={type} value={type}>{mealTypeName(type)}</option>)}</select></div><div className="grid-2 mb-3"><Stepper label="Kcal" value={calories} onChange={setCalories} min={0} max={3000} step={50} /><Stepper label="Proteína (g)" value={proteinG} onChange={setProteinG} min={0} max={300} step={5} /><Stepper label="Carbos (g)" value={carbsG} onChange={setCarbsG} min={0} max={500} step={5} /><Stepper label="Grasas (g)" value={fatG} onChange={setFatG} min={0} max={200} step={5} /></div><div className="dialog__footer"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!name.trim()} onClick={() => onAdd({ customName: name.trim(), mealType, calories, proteinG, carbsG, fatG })}>Añadir</Button></div></Modal>;
}
