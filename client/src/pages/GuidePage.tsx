import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { exerciseCatalogApi, foodCatalogApi } from "../api/resources";
import { Button, EmptyState, ErrorState, ExerciseGuideModal, Loading, RecipeModal, SegmentedControl } from "../components/ui";
import type { CatalogObjective, ExerciseDto, FoodDto, MealType, MuscleGroup } from "../types/api";
import { exerciseImageUrl, mealTypeName, modalityName, muscleGroupName } from "../utils/format";

type GuideView = "exercises" | "foods";
const PAGE_SIZE = 18;
const EXERCISE_TYPES = ["Gym", "Calisthenics", "Both"] as const;
const MUSCLE_GROUPS: MuscleGroup[] = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core"];
const OBJECTIVES: CatalogObjective[] = ["Bulk", "Cut", "Both"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

function objectiveName(value: string): string {
  return { Bulk: "Volumen", Cut: "Definición", Both: "Todos los objetivos" }[value] ?? value;
}

function difficultyName(value: number): string {
  return value === 1 ? "Fácil" : value === 2 ? "Intermedia" : "Avanzada";
}

function Pagination({ page, totalCount, onChange }: { page: number; totalCount: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (totalPages <= 1) return null;
  return <nav className="guide-pagination" aria-label="Paginación del catálogo"><Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><span className="icon">chevron_left</span>Anterior</Button><span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span><Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente<span className="icon">chevron_right</span></Button></nav>;
}

function ExerciseLibrary() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [type, setType] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [objective, setObjective] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [equipment, setEquipment] = useState("");
  const deferredEquipment = useDeferredValue(equipment);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<ExerciseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeFilters = [type, muscleGroup, objective, difficulty, equipment].filter(Boolean).length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    exerciseCatalogApi.search({ search: deferredSearch, type, muscleGroup, objective, difficulty, equipment: deferredEquipment, page, pageSize: PAGE_SIZE })
      .then((result) => { if (active) { setItems(result.items); setTotalCount(result.totalCount); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "No se pudieron cargar los ejercicios."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [deferredSearch, type, muscleGroup, objective, difficulty, deferredEquipment, page]);

  const reset = () => { setSearch(""); setType(""); setMuscleGroup(""); setObjective(""); setDifficulty(""); setEquipment(""); setPage(1); };
  const filterChange = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };

  return <section className="guide-catalog" aria-labelledby="exercise-library-title">
    <div className="guide-catalog__toolbar"><div><h2 id="exercise-library-title">Biblioteca de ejercicios</h2><p>Consulta técnica, músculos, equipamiento e instrucciones paso a paso.</p></div><span className="count-badge" aria-live="polite">{totalCount} ejercicios</span></div>
    <div className="guide-search"><span className="icon">search</span><input className="input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nombre del ejercicio..." aria-label="Buscar ejercicios" />{search && <button type="button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Limpiar búsqueda"><span className="icon">close</span></button>}</div>
    <div className="guide-filters">
      <div className="input-group"><label className="input-group__label">Tipo</label><select className="select" value={type} onChange={(event) => filterChange(setType, event.target.value)}><option value="">Todos</option>{EXERCISE_TYPES.map((value) => <option key={value} value={value}>{modalityName(value)}</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Grupo muscular</label><select className="select" value={muscleGroup} onChange={(event) => filterChange(setMuscleGroup, event.target.value)}><option value="">Todo el cuerpo</option>{MUSCLE_GROUPS.map((value) => <option key={value} value={value}>{muscleGroupName(value)}</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Objetivo</label><select className="select" value={objective} onChange={(event) => filterChange(setObjective, event.target.value)}><option value="">Cualquier objetivo</option>{OBJECTIVES.map((value) => <option key={value} value={value}>{objectiveName(value)}</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Dificultad</label><select className="select" value={difficulty} onChange={(event) => filterChange(setDifficulty, event.target.value)}><option value="">Todas</option>{[1, 2, 3].map((value) => <option key={value} value={value}>{difficultyName(value)}</option>)}</select></div>
      <div className="input-group guide-filters__wide"><label className="input-group__label">Equipamiento</label><input className="input" value={equipment} onChange={(event) => { setEquipment(event.target.value); setPage(1); }} placeholder="Ej. mancuernas, barra, ninguno..." /></div>
    </div>
    <div className="guide-filter-summary"><span>{activeFilters ? `${activeFilters} ${activeFilters === 1 ? "filtro activo" : "filtros activos"}` : "Mostrando todos los ejercicios"}</span>{(activeFilters > 0 || search) && <Button variant="ghost" size="sm" onClick={reset}>Limpiar filtros</Button>}</div>
    {loading ? <Loading message="Cargando ejercicios" /> : error ? <ErrorState message={error} /> : !items.length ? <EmptyState icon="search_off" title="No encontramos ejercicios" description="Prueba con menos filtros o con otro término de búsqueda." action={<Button variant="ghost" onClick={reset}>Ver todos</Button>} /> : <><div className="guide-grid">{items.map((exercise) => { const image = exerciseImageUrl(exercise); return <button key={exercise.id} type="button" className="guide-card" onClick={() => setSelected(exercise)}><div className="guide-card__media guide-card__media--exercise">{image ? <img src={image} alt="" loading="lazy" /> : <span className="icon">fitness_center</span>}<span className="guide-card__level">{difficultyName(exercise.difficulty)}</span></div><div className="guide-card__body"><div className="guide-card__eyebrow">{modalityName(exercise.type)} · {muscleGroupName(exercise.muscleGroup)}</div><h3>{exercise.name}</h3><p>{exercise.description || exercise.target}</p><div className="guide-card__footer"><span><span className="icon">exercise</span>{exercise.equipment}</span><strong>Ver técnica <span className="icon">arrow_forward</span></strong></div></div></button>; })}</div><Pagination page={page} totalCount={totalCount} onChange={setPage} /></>}
    <ExerciseGuideModal exercise={selected} onClose={() => setSelected(null)} />
  </section>;
}

function FoodLibrary() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [mealType, setMealType] = useState("");
  const [objective, setObjective] = useState("");
  const [maxCalories, setMaxCalories] = useState("");
  const [minProtein, setMinProtein] = useState("");
  const [maxSugars, setMaxSugars] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FoodDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<FoodDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeFilters = [mealType, objective, maxCalories, minProtein, maxSugars].filter(Boolean).length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    foodCatalogApi.search({ search: deferredSearch, mealType, objective, maxCalories, minProtein, maxSugars, page, pageSize: PAGE_SIZE })
      .then((result) => { if (active) { setItems(result.items); setTotalCount(result.totalCount); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "No se pudieron cargar las comidas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [deferredSearch, mealType, objective, maxCalories, minProtein, maxSugars, page]);

  const reset = () => { setSearch(""); setMealType(""); setObjective(""); setMaxCalories(""); setMinProtein(""); setMaxSugars(""); setPage(1); };
  const filterChange = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };

  return <section className="guide-catalog" aria-labelledby="food-library-title">
    <div className="guide-catalog__toolbar"><div><h2 id="food-library-title">Recetario completo</h2><p>Revisa porciones, macros, ingredientes y preparación cuando lo necesites.</p></div><span className="count-badge" aria-live="polite">{totalCount} platillos</span></div>
    <div className="guide-search"><span className="icon">search</span><input className="input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar platillo o receta..." aria-label="Buscar comidas" />{search && <button type="button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Limpiar búsqueda"><span className="icon">close</span></button>}</div>
    <div className="guide-filters guide-filters--food">
      <div className="input-group"><label className="input-group__label">Tiempo de comida</label><select className="select" value={mealType} onChange={(event) => filterChange(setMealType, event.target.value)}><option value="">Todos</option>{MEAL_TYPES.map((value) => <option key={value} value={value}>{mealTypeName(value)}</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Objetivo</label><select className="select" value={objective} onChange={(event) => filterChange(setObjective, event.target.value)}><option value="">Cualquier objetivo</option>{OBJECTIVES.map((value) => <option key={value} value={value}>{objectiveName(value)}</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Calorías máximas</label><select className="select" value={maxCalories} onChange={(event) => filterChange(setMaxCalories, event.target.value)}><option value="">Sin límite</option>{[300, 500, 700, 1000].map((value) => <option key={value} value={value}>Hasta {value} kcal</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Proteína mínima</label><select className="select" value={minProtein} onChange={(event) => filterChange(setMinProtein, event.target.value)}><option value="">Cualquiera</option>{[10, 20, 30, 40].map((value) => <option key={value} value={value}>{value} g o más</option>)}</select></div>
      <div className="input-group"><label className="input-group__label">Azúcares máximos</label><select className="select" value={maxSugars} onChange={(event) => filterChange(setMaxSugars, event.target.value)}><option value="">Sin límite</option>{[5, 10, 20].map((value) => <option key={value} value={value}>Hasta {value} g</option>)}</select></div>
    </div>
    <div className="guide-filter-summary"><span>{activeFilters ? `${activeFilters} ${activeFilters === 1 ? "filtro activo" : "filtros activos"}` : "Mostrando todos los platillos"}</span>{(activeFilters > 0 || search) && <Button variant="ghost" size="sm" onClick={reset}>Limpiar filtros</Button>}</div>
    {loading ? <Loading message="Cargando recetario" /> : error ? <ErrorState message={error} /> : !items.length ? <EmptyState icon="search_off" title="No encontramos platillos" description="Prueba con menos filtros o con otro término de búsqueda." action={<Button variant="ghost" onClick={reset}>Ver todos</Button>} /> : <><div className="guide-grid">{items.map((food) => <button key={food.id} type="button" className="guide-card guide-card--food" onClick={() => setSelected(food)}><div className="guide-card__food-icon"><span className="icon">restaurant_menu</span></div><div className="guide-card__body"><div className="guide-card__eyebrow">{mealTypeName(food.mealType)} · {objectiveName(food.objective)}</div><h3>{food.name}</h3><p>{food.description}</p><div className="guide-macros"><span><strong>{food.calories}</strong> kcal</span><span><strong>{food.proteinG}g</strong> P</span><span><strong>{food.carbsG}g</strong> C</span><span><strong>{food.fatG}g</strong> G</span></div><div className="guide-card__footer"><span><span className="icon">dishwasher_gen</span>{food.portions}</span><strong>Ver receta <span className="icon">arrow_forward</span></strong></div></div></button>)}</div><Pagination page={page} totalCount={totalCount} onChange={setPage} /></>}
    <RecipeModal food={selected} onClose={() => setSelected(null)} />
  </section>;
}

export default function GuidePage() {
  const [view, setView] = useState<GuideView>("exercises");
  const description = useMemo(() => view === "exercises" ? "Encuentra cualquier movimiento y revisa su técnica antes de entrenar." : "Encuentra cualquier platillo y consulta cómo prepararlo.", [view]);
  return <div className="page guide-page">
    <div className="hero"><div className="hero__label"><span className="icon">menu_book</span><span>Guía</span></div><h1 className="hero__title">Aprende, consulta y entrena con confianza</h1><p className="hero__subtitle">{description}</p></div>
    <div className="guide-switch"><SegmentedControl block value={view} onChange={setView} options={[{ value: "exercises", label: "Ejercicios" }, { value: "foods", label: "Comidas y recetas" }]} /></div>
    <div hidden={view !== "exercises"}><ExerciseLibrary /></div>
    <div hidden={view !== "foods"}><FoodLibrary /></div>
  </div>;
}
