/**
 * Store Pinia central — FridgeFlow / Meal Planner
 *
 * CONCEPTS VUE UTILISÉS ICI :
 * - ref()      → variable réactive (quand elle change, les composants se re-rendent)
 * - computed() → valeur calculée automatiquement depuis d'autres refs
 * - defineStore() → crée un store Pinia accessible partout dans l'app
 */
import { generateUUID } from '@/utils/uuid'
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// ─────────────────────────────────────────────
// TYPES — le modèle de données complet
// ─────────────────────────────────────────────

export type DietType = 'vegan' | 'fish' | 'all'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner'
export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'pièce' | 'cs' | 'cc'
export type IngredientCategory =
	| 'légume'
	| 'fruit'
	| 'viande'
	| 'poisson'
	| 'féculent'
	| 'produit laitier'
	| 'épice'
	| 'autre'

export interface Ingredient {
	name: string
	qty: number
	unit: IngredientUnit
	category: IngredientCategory
}

export interface Recipe {
	id: string
	name: string
	slot: MealSlot | 'any'
	diet: DietType
	tags: string[]
	calories: number
	prepTime: number        // minutes
	cookTime: number        // minutes
	servings: number
	ingredients: Ingredient[]
	steps: string[]
	origin: 'manual' | 'claude'
	rating: 1 | 2 | 3 | 4 | 5
	usageCount: number
	lastUsed: string | null // ISO date
	createdAt: string
	notes: string
}

export interface InventoryItem extends Ingredient {
	id: string
	location: 'fridge' | 'pantry'
	expiry: string | null   // ISO date — alerte si < 3 jours
	addedAt: string
}

export interface PlannedMeal {
	recipeId: string
	name: string            // dénormalisé pour affichage rapide
	calories: number
	diet: DietType
	locked: boolean         // verrouillé = pas remplacé par "régénérer"
}

export interface DayPlan {
	breakfast: PlannedMeal | null
	lunch: PlannedMeal | null
	dinner: PlannedMeal | null
}

export interface WeekPlan {
	weekStart: string       // lundi de la semaine ISO (ex: "2026-03-16")
	days: Record<string, DayPlan>
}

export interface DayConstraint {
	diet: DietType
	maxCal: number | null
	mustUseIngredient: string | null
}

export interface ConstraintProfile {
	id: string
	name: string
	global: {
		maxCalPerMeal: number
		maxCalPerDay: number
	}
	days: Record<string, DayConstraint>
}

export interface Constraints {
	global: {
		maxCalPerMeal: number
		maxCalPerDay: number
	}
	days: Record<string, DayConstraint>
	profiles: ConstraintProfile[]
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

export const DAYS = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday',
] as const

export const DAYS_FR: Record<string, string> = {
	monday: 'Lundi',
	tuesday: 'Mardi',
	wednesday: 'Mercredi',
	thursday: 'Jeudi',
	friday: 'Vendredi',
	saturday: 'Samedi',
	sunday: 'Dimanche',
}

export const SLOTS_FR: Record<MealSlot, string> = {
	breakfast: 'Petit-déjeuner',
	lunch: 'Déjeuner',
	dinner: 'Dîner',
}

export const DIET_LABELS: Record<DietType, string> = {
	vegan: '🥦 Vegan',
	fish: '🐟 Poisson',
	all: '🍽️ Tout',
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Génère un UUID simple */
function generateId(): string {
	return generateUUID()
}

/** Retourne la date du lundi de la semaine courante au format ISO */
function getCurrentWeekStart(): string {
	const now = new Date()
	const day = now.getDay()
	// getDay() retourne 0=dimanche, 1=lundi...
	const diff = day === 0 ? -6 : 1 - day
	const monday = new Date(now)
	monday.setDate(now.getDate() + diff)
	return monday.toISOString().split('T')[0]
}

/** Crée un DayPlan vide */
function emptyDayPlan(): DayPlan {
	return { breakfast: null, lunch: null, dinner: null }
}

/** Crée les contraintes par défaut pour tous les jours */
function defaultDayConstraints(): Record<string, DayConstraint> {
	const constraints: Record<string, DayConstraint> = {}
	for (const day of DAYS) {
		constraints[day] = {
			diet: 'all',
			maxCal: null,
			mustUseIngredient: null,
		}
	}
	return constraints
}

/** Crée un WeekPlan vide pour la semaine courante */
function emptyWeekPlan(): WeekPlan {
	const days: Record<string, DayPlan> = {}
	for (const day of DAYS) {
		days[day] = emptyDayPlan()
	}
	return {
		weekStart: getCurrentWeekStart(),
		days,
	}
}

// ─────────────────────────────────────────────
// PERSISTANCE — localStorage
// (sera remplacé par l'API Vikunja en production)
// ─────────────────────────────────────────────

const STORAGE_KEYS = {
	recipes: 'fridgeflow_recipes',
	inventory: 'fridgeflow_inventory',
	weekPlan: 'fridgeflow_weekplan',
	constraints: 'fridgeflow_constraints',
} as const

function loadFromStorage<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key)
		return raw ? (JSON.parse(raw) as T) : fallback
	} catch {
		return fallback
	}
}

function saveToStorage(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch (e) {
		console.error('Erreur sauvegarde localStorage:', e)
	}
}

// ─────────────────────────────────────────────
// LE STORE
// ─────────────────────────────────────────────

export const useMealPlannerStore = defineStore('mealPlanner', () => {

	// ── STATE ──────────────────────────────────
	// ref() = variable réactive : quand elle change, tous les composants
	// qui l'utilisent se re-rendent automatiquement

	const recipes = ref<Recipe[]>(
		loadFromStorage(STORAGE_KEYS.recipes, []),
	)

	const inventory = ref<InventoryItem[]>(
		loadFromStorage(STORAGE_KEYS.inventory, []),
	)

	const weekPlan = ref<WeekPlan>(
		loadFromStorage(STORAGE_KEYS.weekPlan, emptyWeekPlan()),
	)

	const constraints = ref<Constraints>(
		loadFromStorage(STORAGE_KEYS.constraints, {
			global: {
				maxCalPerMeal: 700,
				maxCalPerDay: 2000,
			},
			days: defaultDayConstraints(),
			profiles: [],
		}),
	)

	// Section active dans la navigation
	const activeSection = ref<'planning' | 'constraints' | 'inventory' | 'shopping' | 'recipes'>('planning')

	// Repas sélectionné pour le panneau de détail
	const selectedRecipeId = ref<string | null>(null)

	// Cellule active dans la grille (pour le panneau de sélection)
	const activeCellSlot = ref<{ day: string; slot: MealSlot } | null>(null)

	// État de chargement global (appels Claude)
	const isLoading = ref(false)
	const loadingMessage = ref('')

	// ── GETTERS ────────────────────────────────
	// computed() = valeur calculée automatiquement
	// Elle se recalcule UNIQUEMENT quand ses dépendances changent

	/** Recette sélectionnée */
	const selectedRecipe = computed(() =>
		recipes.value.find(r => r.id === selectedRecipeId.value) ?? null,
	)

	/** Items du frigo uniquement */
	const fridgeItems = computed(() =>
		inventory.value.filter(item => item.location === 'fridge'),
	)

	/** Items du placard uniquement */
	const pantryItems = computed(() =>
		inventory.value.filter(item => item.location === 'pantry'),
	)

	/** Items proches de péremption (< 3 jours) */
	const expiringItems = computed(() => {
		const threeDaysFromNow = new Date()
		threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
		return inventory.value.filter(item => {
			if (!item.expiry) return false
			return new Date(item.expiry) <= threeDaysFromNow
		})
	})

	/** Total calories par jour pour la semaine courante */
	const dailyCalories = computed(() => {
		const totals: Record<string, number> = {}
		for (const day of DAYS) {
			const dayPlan = weekPlan.value.days[day]
			totals[day] =
				(dayPlan.breakfast?.calories ?? 0) +
				(dayPlan.lunch?.calories ?? 0) +
				(dayPlan.dinner?.calories ?? 0)
		}
		return totals
	})

	/** Statut de conformité par jour (calories + type de régime) */
	const dayStatus = computed(() => {
		const status: Record<string, 'ok' | 'warning' | 'error'> = {}
		for (const day of DAYS) {
			const dayPlan = weekPlan.value.days[day]
			const dayConstraint = constraints.value.days[day]
			const maxCal = dayConstraint.maxCal ?? constraints.value.global.maxCalPerDay
			const calories = dailyCalories.value[day]

			// Vérification des calories
			if (calories > maxCal) {
				status[day] = 'error'
				continue
			}
			if (calories > maxCal * 0.9) {
				status[day] = 'warning'
				continue
			}

			// Vérification du type de régime
			const meals = [dayPlan.breakfast, dayPlan.lunch, dayPlan.dinner].filter(Boolean)
			const violation = meals.some(meal => {
				if (!meal) return false
				if (dayConstraint.diet === 'vegan' && meal.diet !== 'vegan') return true
				if (dayConstraint.diet === 'fish' && meal.diet === 'all') return true
				return false
			})
			status[day] = violation ? 'error' : 'ok'
		}
		return status
	})

	/** Recettes faisables avec l'inventaire actuel */
	const cookableRecipes = computed(() => {
		const inventoryNames = inventory.value.map(i => i.name.toLowerCase())
		return recipes.value.filter(recipe =>
			recipe.ingredients.every(ingredient =>
				inventoryNames.some(name =>
					name.includes(ingredient.name.toLowerCase()) ||
					ingredient.name.toLowerCase().includes(name),
				),
			),
		)
	})

	/** Liste de courses calculée depuis le planning */
	const shoppingList = computed(() => {
		// 1. Collecter tous les ingrédients nécessaires
		const needed: Record<string, { ingredient: Ingredient; totalQty: number }> = {}

		for (const day of DAYS) {
			const dayPlan = weekPlan.value.days[day]
			const slots: (PlannedMeal | null)[] = [dayPlan.breakfast, dayPlan.lunch, dayPlan.dinner]

			for (const meal of slots) {
				if (!meal) continue
				const recipe = recipes.value.find(r => r.id === meal.recipeId)
				if (!recipe) continue

				for (const ing of recipe.ingredients) {
					const key = `${ing.name}_${ing.unit}`
					if (needed[key]) {
						needed[key].totalQty += ing.qty
					} else {
						needed[key] = { ingredient: { ...ing }, totalQty: ing.qty }
					}
				}
			}
		}

		// 2. Soustraire ce qui est dans l'inventaire
		return Object.values(needed).map(({ ingredient, totalQty }) => {
			const inStock = inventory.value
				.filter(item => item.name.toLowerCase() === ingredient.name.toLowerCase())
				.reduce((sum, item) => sum + item.qty, 0)

			return {
				...ingredient,
				totalQty,
				inStock,
				toBuy: Math.max(0, totalQty - inStock),
				checked: false,
			}
		}).filter(item => item.toBuy > 0)
	})

	// ── ACTIONS ────────────────────────────────
	// Fonctions qui modifient le state

	// -- Navigation --

	function setActiveSection(section: typeof activeSection.value) {
		activeSection.value = section
	}

	function setActiveCellSlot(day: string, slot: MealSlot) {
		activeCellSlot.value = { day, slot }
	}

	function clearActiveCellSlot() {
		activeCellSlot.value = null
	}

	// -- Recettes --

	function addRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>) {
		const newRecipe: Recipe = {
			...recipe,
			id: generateId(),
			createdAt: new Date().toISOString(),
			usageCount: 0,
			lastUsed: null,
		}
		recipes.value.push(newRecipe)
		saveToStorage(STORAGE_KEYS.recipes, recipes.value)
		return newRecipe
	}

	function updateRecipe(id: string, updates: Partial<Recipe>) {
		const index = recipes.value.findIndex(r => r.id === id)
		if (index !== -1) {
			recipes.value[index] = { ...recipes.value[index], ...updates }
			saveToStorage(STORAGE_KEYS.recipes, recipes.value)
		}
	}

	function deleteRecipe(id: string) {
		recipes.value = recipes.value.filter(r => r.id !== id)
		saveToStorage(STORAGE_KEYS.recipes, recipes.value)
	}

	function selectRecipe(id: string | null) {
		selectedRecipeId.value = id
	}

	// -- Planning --

	function assignMeal(day: string, slot: MealSlot, recipe: Recipe) {
		if (!weekPlan.value.days[day]) {
			weekPlan.value.days[day] = emptyDayPlan()
		}

		weekPlan.value.days[day][slot] = {
			recipeId: recipe.id,
			name: recipe.name,
			calories: recipe.calories,
			diet: recipe.diet,
			locked: false,
		}

		// Incrémenter le compteur d'utilisation
		updateRecipe(recipe.id, {
			usageCount: recipe.usageCount + 1,
			lastUsed: new Date().toISOString().split('T')[0],
		})

		saveToStorage(STORAGE_KEYS.weekPlan, weekPlan.value)
	}

	function removeMeal(day: string, slot: MealSlot) {
		if (weekPlan.value.days[day]) {
			weekPlan.value.days[day][slot] = null
			saveToStorage(STORAGE_KEYS.weekPlan, weekPlan.value)
		}
	}

	function toggleMealLock(day: string, slot: MealSlot) {
		const meal = weekPlan.value.days[day]?.[slot]
		if (meal) {
			meal.locked = !meal.locked
			saveToStorage(STORAGE_KEYS.weekPlan, weekPlan.value)
		}
	}

	function clearWeek() {
		for (const day of DAYS) {
			weekPlan.value.days[day] = emptyDayPlan()
		}
		saveToStorage(STORAGE_KEYS.weekPlan, weekPlan.value)
	}

	function navigateWeek(direction: 'prev' | 'next') {
		const current = new Date(weekPlan.value.weekStart)
		current.setDate(current.getDate() + (direction === 'next' ? 7 : -7))
		weekPlan.value = {
			weekStart: current.toISOString().split('T')[0],
			days: Object.fromEntries(DAYS.map(d => [d, emptyDayPlan()])),
		}
		saveToStorage(STORAGE_KEYS.weekPlan, weekPlan.value)
	}

	// -- Inventaire --

	function addInventoryItem(item: Omit<InventoryItem, 'id' | 'addedAt'>) {
		const newItem: InventoryItem = {
			...item,
			id: generateId(),
			addedAt: new Date().toISOString(),
		}
		inventory.value.push(newItem)
		saveToStorage(STORAGE_KEYS.inventory, inventory.value)
		return newItem
	}

	function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
		const index = inventory.value.findIndex(i => i.id === id)
		if (index !== -1) {
			inventory.value[index] = { ...inventory.value[index], ...updates }
			saveToStorage(STORAGE_KEYS.inventory, inventory.value)
		}
	}

	function removeInventoryItem(id: string) {
		inventory.value = inventory.value.filter(i => i.id !== id)
		saveToStorage(STORAGE_KEYS.inventory, inventory.value)
	}

	/**
	 * Parse une saisie rapide type "500g poulet" ou "3 courgettes"
	 * Retourne un objet Ingredient partiel
	 */
	function parseQuickInput(input: string): Partial<Ingredient> {
		const normalized = input.trim().toLowerCase()

		// Regex : quantité optionnelle + unité optionnelle + nom
		const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cs|cc|pièces?|pcs?)?\s+(.+)$/)

		if (match) {
			const qty = parseFloat(match[1].replace(',', '.'))
			const rawUnit = match[2]?.replace('pièces', 'pièce').replace('pcs', 'pièce') ?? 'pièce'
			const name = match[3].trim()
			return {
				name: name.charAt(0).toUpperCase() + name.slice(1),
				qty,
				unit: rawUnit as IngredientUnit,
				category: guessCategory(name),
			}
		}

		// Pas de quantité trouvée — juste le nom
		return {
			name: normalized.charAt(0).toUpperCase() + normalized.slice(1),
			qty: 1,
			unit: 'pièce',
			category: 'autre',
		}
	}

	/** Devine la catégorie d'un ingrédient par son nom */
	function guessCategory(name: string): IngredientCategory {
		const legumes = ['courgette', 'carotte', 'tomate', 'oignon', 'ail', 'poireau', 'épinard', 'brocoli', 'chou', 'poivron', 'aubergine', 'haricot', 'petits pois', 'champignon', 'salade', 'laitue']
		const fruits = ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'framboise', 'raisin', 'mangue', 'ananas']
		const viandes = ['poulet', 'bœuf', 'veau', 'porc', 'agneau', 'dinde', 'canard', 'lapin', 'jambon', 'lardons']
		const poissons = ['saumon', 'thon', 'cabillaud', 'dorade', 'truite', 'crevette', 'moule', 'sardine', 'maquereau']
		const feculents = ['pâtes', 'riz', 'pomme de terre', 'lentille', 'pois chiche', 'quinoa', 'pain', 'farine', 'semoule']
		const laitiers = ['lait', 'fromage', 'beurre', 'crème', 'yaourt', 'œuf', 'gruyère', 'parmesan', 'mozzarella']
		const epices = ['sel', 'poivre', 'cumin', 'paprika', 'curry', 'thym', 'romarin', 'basilic', 'persil', 'coriandre']

		const n = name.toLowerCase()
		if (legumes.some(l => n.includes(l))) return 'légume'
		if (fruits.some(f => n.includes(f))) return 'fruit'
		if (viandes.some(v => n.includes(v))) return 'viande'
		if (poissons.some(p => n.includes(p))) return 'poisson'
		if (feculents.some(f => n.includes(f))) return 'féculent'
		if (laitiers.some(l => n.includes(l))) return 'produit laitier'
		if (epices.some(e => n.includes(e))) return 'épice'
		return 'autre'
	}

	// -- Contraintes --

	function updateGlobalConstraints(updates: Partial<Constraints['global']>) {
		constraints.value.global = { ...constraints.value.global, ...updates }
		saveToStorage(STORAGE_KEYS.constraints, constraints.value)
	}

	function updateDayConstraint(day: string, updates: Partial<DayConstraint>) {
		constraints.value.days[day] = { ...constraints.value.days[day], ...updates }
		saveToStorage(STORAGE_KEYS.constraints, constraints.value)
	}

	function saveConstraintProfile(name: string) {
		const profile: ConstraintProfile = {
			id: generateId(),
			name,
			global: { ...constraints.value.global },
			days: JSON.parse(JSON.stringify(constraints.value.days)),
		}
		constraints.value.profiles.push(profile)
		saveToStorage(STORAGE_KEYS.constraints, constraints.value)
	}

	function loadConstraintProfile(profileId: string) {
		const profile = constraints.value.profiles.find(p => p.id === profileId)
		if (profile) {
			constraints.value.global = { ...profile.global }
			constraints.value.days = JSON.parse(JSON.stringify(profile.days))
			saveToStorage(STORAGE_KEYS.constraints, constraints.value)
		}
	}

	function deleteConstraintProfile(profileId: string) {
		constraints.value.profiles = constraints.value.profiles.filter(p => p.id !== profileId)
		saveToStorage(STORAGE_KEYS.constraints, constraints.value)
	}

	// -- Loading state (pour les appels Claude) --

	function setLoading(loading: boolean, message = '') {
		isLoading.value = loading
		loadingMessage.value = message
	}

	// ── RETURN ─────────────────────────────────
	// Tout ce qui est retourné ici est accessible
	// depuis n'importe quel composant via :
	// const store = useMealPlannerStore()

	return {
		// State
		recipes,
		inventory,
		weekPlan,
		constraints,
		activeSection,
		selectedRecipeId,
		activeCellSlot,
		isLoading,
		loadingMessage,

		// Getters
		selectedRecipe,
		fridgeItems,
		pantryItems,
		expiringItems,
		dailyCalories,
		dayStatus,
		cookableRecipes,
		shoppingList,

		// Actions — Navigation
		setActiveSection,
		setActiveCellSlot,
		clearActiveCellSlot,

		// Actions — Recettes
		addRecipe,
		updateRecipe,
		deleteRecipe,
		selectRecipe,

		// Actions — Planning
		assignMeal,
		removeMeal,
		toggleMealLock,
		clearWeek,
		navigateWeek,

		// Actions — Inventaire
		addInventoryItem,
		updateInventoryItem,
		removeInventoryItem,
		parseQuickInput,

		// Actions — Contraintes
		updateGlobalConstraints,
		updateDayConstraint,
		saveConstraintProfile,
		loadConstraintProfile,
		deleteConstraintProfile,

		// Actions — Loading
		setLoading,

		// Constantes exportées pour les composants
		DAYS,
		DAYS_FR,
		SLOTS_FR,
		DIET_LABELS,
	}
})