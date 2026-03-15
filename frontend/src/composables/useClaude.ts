/**
 * Composable useClaude
 * Gère tous les appels à l'API Anthropic pour FridgeFlow.
 *
 * CONCEPT VUE : un "composable" est une fonction réutilisable qui
 * encapsule de la logique avec de la réactivité Vue.
 * Convention de nommage : toujours commencer par "use".
 *
 * SÉCURITÉ : la clé API est lue depuis import.meta.env.VITE_ANTHROPIC_API_KEY
 * Elle ne doit JAMAIS être hardcodée ici ni commitée.
 */

import { ref } from 'vue'
import type {
	Recipe,
	InventoryItem,
	Constraints,
	DietType,
	MealSlot,
	PlannedMeal,
} from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'

// ─────────────────────────────────────────────
// TYPES INTERNES
// ─────────────────────────────────────────────

interface ClaudeMessage {
	role: 'user' | 'assistant'
	content: string
}

interface SuggestMealsOptions {
	day: string
	slot: MealSlot
	count?: number          // nombre de suggestions (défaut: 3)
}

interface GenerateWeekOptions {
	existingRecipes: Recipe[]  // recettes déjà dans la base (à prioriser)
	lockedMeals: Partial<Record<string, Partial<Record<MealSlot, PlannedMeal>>>>
}

interface GenerateRecipeOptions {
	description: string        // description libre de l'utilisateur
}

interface GenerateVariantOptions {
	originalRecipe: Recipe
	variationHint?: string     // ex: "version plus légère", "sans gluten"
}

// ─────────────────────────────────────────────
// PROMPTS SYSTÈME
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un assistant culinaire intégré dans une app de planification de repas appelée FridgeFlow.

Tu génères TOUJOURS des réponses en JSON valide, sans markdown, sans texte avant ou après le JSON.
Ne jamais écrire \`\`\`json ou \`\`\` — uniquement le JSON brut.

Les types de régime possibles sont EXACTEMENT :
- "vegan" : aucun produit animal (ni viande, ni poisson, ni œuf, ni lait)
- "fish" : seule protéine animale autorisée = poisson et fruits de mer
- "all" : aucune restriction

Les unités possibles : "g", "kg", "ml", "l", "pièce", "cs", "cc"
Les catégories d'ingrédients : "légume", "fruit", "viande", "poisson", "féculent", "produit laitier", "épice", "autre"
Les slots de repas : "breakfast", "lunch", "dinner", "any"

Génère des recettes françaises réalistes, variées, avec des temps et calories réalistes.
Les calories sont pour UNE portion.`

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Formate l'inventaire pour le prompt */
function formatInventory(inventory: InventoryItem[]): string {
	if (inventory.length === 0) return 'Inventaire vide'
	return inventory
		.map(i => `${i.name} (${i.qty}${i.unit})`)
		.join(', ')
}

/** Formate les contraintes du jour pour le prompt */
function formatDayConstraint(
	day: string,
	constraints: Constraints,
): string {
	const dayConstraint = constraints.days[day]
	const maxCal = dayConstraint.maxCal ?? constraints.global.maxCalPerDay
	const dietLabel = {
		vegan: 'vegan (aucun produit animal)',
		fish: 'poisson uniquement comme protéine animale',
		all: 'sans restriction',
	}[dayConstraint.diet]

	let result = `Régime du jour : ${dietLabel}. Calories max par jour : ${maxCal} kcal. Calories max par repas : ${constraints.global.maxCalPerMeal} kcal.`

	if (dayConstraint.mustUseIngredient) {
		result += ` Ingrédient à utiliser obligatoirement : ${dayConstraint.mustUseIngredient}.`
	}

	return result
}

/** Formate les noms des recettes existantes pour éviter les doublons */
function formatExistingRecipes(recipes: Recipe[]): string {
	if (recipes.length === 0) return 'Aucune recette dans la base.'
	return recipes.map(r => r.name).join(', ')
}

/** Schéma JSON d'une recette pour le prompt */
const RECIPE_SCHEMA = `{
  "name": "string",
  "slot": "breakfast|lunch|dinner|any",
  "diet": "vegan|fish|all",
  "tags": ["string"],
  "calories": number,
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "ingredients": [{"name": "string", "qty": number, "unit": "string", "category": "string"}],
  "steps": ["string"],
  "notes": "string"
}`

// ─────────────────────────────────────────────
// APPEL API ANTHROPIC
// ─────────────────────────────────────────────

async function callClaude(messages: ClaudeMessage[]): Promise<string> {
	const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

	if (!apiKey) {
		throw new Error('Clé API Anthropic manquante. Vérifie ton fichier .env.local')
	}

	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			// Nécessaire pour les appels depuis le navigateur
			'anthropic-dangerous-request-header': 'true',
		},
		body: JSON.stringify({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 4000,
			system: SYSTEM_PROMPT,
			messages,
		}),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({}))
		throw new Error(`Erreur API Anthropic (${response.status}): ${JSON.stringify(error)}`)
	}

	const data = await response.json()
	return data.content[0]?.text ?? ''
}

/** Parse une réponse JSON de Claude en toute sécurité */
function parseClaudeJson<T>(raw: string): T {
	// Nettoyer les éventuels backticks markdown que Claude aurait quand même mis
	const cleaned = raw
		.replace(/```json\n?/g, '')
		.replace(/```\n?/g, '')
		.trim()

	return JSON.parse(cleaned) as T
}

// ─────────────────────────────────────────────
// LE COMPOSABLE
// ─────────────────────────────────────────────

export function useClaude() {
	const store = useMealPlannerStore()

	// État local du composable
	const isLoading = ref(false)
	const error = ref<string | null>(null)

	/** Wrapper qui gère le loading et les erreurs */
	async function withLoading<T>(
		message: string,
		fn: () => Promise<T>,
	): Promise<T | null> {
		isLoading.value = true
		error.value = null
		store.setLoading(true, message)

		try {
			return await fn()
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Erreur inconnue'
			error.value = msg
			console.error('[useClaude]', msg)
			return null
		} finally {
			isLoading.value = false
			store.setLoading(false)
		}
	}

	// ── 1. SUGGÉRER DES REPAS ─────────────────
	// Appelé depuis le panneau de sélection d'une cellule du planning

	async function suggestMeals(options: SuggestMealsOptions): Promise<Recipe[]> {
		const result = await withLoading(
			'Claude réfléchit à des suggestions...',
			async () => {
				const { day, slot, count = 3 } = options
				const slotFr = { breakfast: 'petit-déjeuner', lunch: 'déjeuner', dinner: 'dîner' }[slot]
				const dayConstraintText = formatDayConstraint(day, store.constraints)
				const inventoryText = formatInventory(store.inventory)
				const existingText = formatExistingRecipes(store.recipes)

				const prompt = `Propose ${count} recettes différentes pour le ${slotFr}.

Contraintes du jour : ${dayConstraintText}
Inventaire disponible : ${inventoryText}
Recettes déjà dans la base (évite les doublons) : ${existingText}

Priorise les ingrédients de l'inventaire. Si possible, utilise des ingrédients proches de leur date de péremption.

Réponds UNIQUEMENT avec un tableau JSON de ${count} recettes, chacune au format :
${RECIPE_SCHEMA}

Format attendu : [{ recette1 }, { recette2 }, { recette3 }]`

				const raw = await callClaude([{ role: 'user', content: prompt }])
				const recipes = parseClaudeJson<Omit<Recipe, 'id' | 'createdAt' | 'usageCount' | 'lastUsed' | 'origin' | 'rating'>[]>(raw)

				// Enrichir avec les champs manquants
				return recipes.map(r => ({
					...r,
					id: crypto.randomUUID(),
					createdAt: new Date().toISOString(),
					usageCount: 0,
					lastUsed: null,
					origin: 'claude' as const,
					rating: 3 as const,
				}))
			},
		)

		return result ?? []
	}

	// ── 2. GÉNÉRER LA SEMAINE COMPLÈTE ────────
	// Appelé depuis le bouton "✨ Générer la semaine"

	async function generateWeek(options: GenerateWeekOptions): Promise<Partial<Record<string, Partial<Record<MealSlot, Recipe>>>>> {
		const result = await withLoading(
			'Claude planifie votre semaine...',
			async () => {
				const { existingRecipes, lockedMeals } = options

				// Construire la description des contraintes par jour
				const daysConstraints = store.DAYS.map(day => {
					const c = store.constraints.days[day]
					const maxCal = c.maxCal ?? store.constraints.global.maxCalPerDay
					const dietLabel = { vegan: 'vegan', fish: 'poisson uniquement', all: 'libre' }[c.diet]
					const locked = lockedMeals[day]
					const lockedText = locked
						? Object.entries(locked)
							.filter(([, v]) => v)
							.map(([slot, meal]) => `${slot}: "${meal!.name}" (verrouillé)`)
							.join(', ')
						: ''
					return `${store.DAYS_FR[day]}: régime=${dietLabel}, max=${maxCal}kcal/jour${lockedText ? `, déjà planifié: ${lockedText}` : ''}`
				}).join('\n')

				const prompt = `Génère un planning de repas pour une semaine complète (petit-déjeuner, déjeuner et dîner pour chaque jour).

Contraintes globales :
- Calories max par repas : ${store.constraints.global.maxCalPerMeal} kcal
- Contraintes par jour :
${daysConstraints}

Inventaire disponible : ${formatInventory(store.inventory)}
Recettes existantes à prioriser : ${formatExistingRecipes(existingRecipes)}

Règles :
- Ne génère PAS les repas marqués comme "verrouillé"
- Utilise les recettes existantes quand elles correspondent aux contraintes
- Varie les repas sur la semaine (pas deux fois le même)
- Priorise l'utilisation des ingrédients de l'inventaire

Réponds UNIQUEMENT avec un objet JSON :
{
  "monday": { "breakfast": ${RECIPE_SCHEMA}, "lunch": ${RECIPE_SCHEMA}, "dinner": ${RECIPE_SCHEMA} },
  "tuesday": { ... },
  ...
}

Omet les jours/slots verrouillés de ta réponse.`

				const raw = await callClaude([{ role: 'user', content: prompt }])

				// Claude retourne des recettes partielles — on enrichit chaque slot
				type RawWeek = Partial<Record<string, Partial<Record<MealSlot,
					Omit<Recipe, 'id' | 'createdAt' | 'usageCount' | 'lastUsed' | 'origin' | 'rating'>
				>>>>

				const rawWeek = parseClaudeJson<RawWeek>(raw)

				// Enrichir chaque recette avec les champs manquants
				const enriched: Partial<Record<string, Partial<Record<MealSlot, Recipe>>>> = {}
				for (const [day, slots] of Object.entries(rawWeek)) {
					if (!slots) continue
					enriched[day] = {}
					for (const [slot, recipe] of Object.entries(slots)) {
						if (!recipe) continue
						enriched[day]![slot as MealSlot] = {
							...recipe,
							id: crypto.randomUUID(),
							createdAt: new Date().toISOString(),
							usageCount: 0,
							lastUsed: null,
							origin: 'claude' as const,
							rating: 3 as const,
						}
					}
				}
				return enriched
			},
		)

		return result ?? {}
	}

	// ── 3. GÉNÉRER UNE RECETTE DEPUIS UNE DESCRIPTION ──
	// Appelé depuis la base de menus : "Décris un repas"

	async function generateRecipeFromDescription(options: GenerateRecipeOptions): Promise<Recipe | null> {
		return withLoading(
			'Claude génère la recette...',
			async () => {
				const { description } = options

				const prompt = `Génère une recette détaillée basée sur cette description : "${description}"

Inventaire disponible (utilise ces ingrédients si possible) : ${formatInventory(store.inventory)}

Réponds UNIQUEMENT avec un objet JSON unique au format :
${RECIPE_SCHEMA}`

				const raw = await callClaude([{ role: 'user', content: prompt }])
				const recipe = parseClaudeJson<Omit<Recipe, 'id' | 'createdAt' | 'usageCount' | 'lastUsed' | 'origin' | 'rating'>>(raw)

				return {
					...recipe,
					id: crypto.randomUUID(),
					createdAt: new Date().toISOString(),
					usageCount: 0,
					lastUsed: null,
					origin: 'claude' as const,
					rating: 3 as const,
				}
			},
		)
	}

	// ── 4. GÉNÉRER UNE VARIANTE D'UNE RECETTE ──
	// Appelé depuis la fiche détail d'une recette

	async function generateRecipeVariant(options: GenerateVariantOptions): Promise<Recipe | null> {
		return withLoading(
			'Claude crée une variante...',
			async () => {
				const { originalRecipe, variationHint } = options

				const prompt = `Génère une variante de cette recette : "${originalRecipe.name}"

Recette originale :
- Régime : ${originalRecipe.diet}
- Ingrédients : ${originalRecipe.ingredients.map(i => `${i.qty}${i.unit} ${i.name}`).join(', ')}
- Calories : ${originalRecipe.calories} kcal

${variationHint ? `Indication pour la variante : ${variationHint}` : 'Propose une variante créative qui garde l\'esprit de la recette originale.'}

Inventaire disponible : ${formatInventory(store.inventory)}

Réponds UNIQUEMENT avec un objet JSON au format :
${RECIPE_SCHEMA}`

				const raw = await callClaude([{ role: 'user', content: prompt }])
				const recipe = parseClaudeJson<Omit<Recipe, 'id' | 'createdAt' | 'usageCount' | 'lastUsed' | 'origin' | 'rating'>>(raw)

				return {
					...recipe,
					id: crypto.randomUUID(),
					createdAt: new Date().toISOString(),
					usageCount: 0,
					lastUsed: null,
					origin: 'claude' as const,
					rating: 3 as const,
				}
			},
		)
	}

	// ── 5. SUGGÉRER DES REPAS AVEC L'INVENTAIRE ──
	// Appelé depuis l'inventaire : "Que puis-je cuisiner ?"

	async function suggestFromInventory(day: string): Promise<Recipe[]> {
		const result = await withLoading(
			'Claude analyse votre inventaire...',
			async () => {
				if (store.inventory.length === 0) {
					throw new Error('Votre inventaire est vide !')
				}

				const dayConstraintText = formatDayConstraint(day, store.constraints)
				const expiringText = store.expiringItems.length > 0
					? `⚠️ À utiliser en priorité (proche péremption) : ${store.expiringItems.map(i => i.name).join(', ')}`
					: ''

				const prompt = `Propose 3 repas réalisables UNIQUEMENT avec ces ingrédients (ou un sous-ensemble) :
${formatInventory(store.inventory)}

${expiringText}

Contraintes du jour : ${dayConstraintText}
Recettes existantes (évite les doublons) : ${formatExistingRecipes(store.recipes)}

Réponds UNIQUEMENT avec un tableau JSON de 3 recettes :
[${RECIPE_SCHEMA}, ...]`

				const raw = await callClaude([{ role: 'user', content: prompt }])
				const recipes = parseClaudeJson<Omit<Recipe, 'id' | 'createdAt' | 'usageCount' | 'lastUsed' | 'origin' | 'rating'>[]>(raw)

				return recipes.map(r => ({
					...r,
					id: crypto.randomUUID(),
					createdAt: new Date().toISOString(),
					usageCount: 0,
					lastUsed: null,
					origin: 'claude' as const,
					rating: 3 as const,
				}))
			},
		)

		return result ?? []
	}

	return {
		// État
		isLoading,
		error,

		// Actions
		suggestMeals,
		generateWeek,
		generateRecipeFromDescription,
		generateRecipeVariant,
		suggestFromInventory,
	}
}