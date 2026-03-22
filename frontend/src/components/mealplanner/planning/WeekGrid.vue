<template>
	<div class="week-grid">
		<!-- Barre d'actions -->
		<div class="week-grid__toolbar">
			<!-- Navigation semaine -->
			<div class="week-grid__nav">
				<button
					class="week-grid__nav-btn"
					@click="store.navigateWeek('prev')"
				>
					‹
				</button>
				<span class="week-grid__week-label">
					Semaine du {{ formatWeekStart(store.weekPlan.weekStart) }}
				</span>
				<button
					class="week-grid__nav-btn"
					@click="store.navigateWeek('next')"
				>
					›
				</button>
			</div>

			<!-- Actions globales -->
			<div class="week-grid__actions">
				<button
					class="week-grid__btn week-grid__btn--primary"
					:disabled="store.isLoading"
					@click="handleGenerateWeek"
				>
					✨ Générer la semaine
				</button>
				<button
					class="week-grid__btn week-grid__btn--danger"
					@click="handleClearWeek"
				>
					🗑️ Tout effacer
				</button>
			</div>
		</div>

		<!-- Grille -->
		<div class="week-grid__grid">
			<!-- En-têtes des jours -->
			<div class="week-grid__corner" />
			<div
				v-for="day in store.DAYS"
				:key="day"
				class="week-grid__day-header"
				:class="`diet-header--${store.constraints.days[day]?.diet}`"
			>
				<span class="week-grid__day-name">{{ store.DAYS_FR[day] }}</span>
				<span class="week-grid__day-diet">
					{{ DIET_LABELS[store.constraints.days[day]?.diet ?? 'all'] }}
				</span>
			</div>

			<!-- Lignes par slot -->
			<template
				v-for="slot in SLOTS"
				:key="slot"
			>
				<!-- Label du slot -->
				<div class="week-grid__slot-label">
					{{ store.SLOTS_FR[slot] }}
				</div>

				<!-- Cellules -->
				<MealCell
					v-for="day in store.DAYS"
					:key="`${day}-${slot}`"
					:slot="slot"
					:day="day"
					:meal="store.weekPlan.days[day]?.[slot] ?? null"
					@click="openSelectPanel"
					@remove="store.removeMeal"
					@toggleLock="store.toggleMealLock"
				/>
			</template>
		</div>

		<!-- Barre récap -->
		<WeekSummaryBar />

		<!-- Panneau de sélection -->
		<MealSelectPanel
			:slot="activeSlot"
			:is-open="panelOpen"
			:day="activeDay"
			@close="panelOpen = false"
			@select="handleRecipeSelected"
		/>

		<!-- Modal confirmation effacement -->
		<Teleport to="body">
			<Transition name="fade">
				<div
					v-if="showClearConfirm"
					class="week-grid__confirm-overlay"
				>
					<div class="week-grid__confirm-card">
						<p>Effacer tous les repas de la semaine ?</p>
						<div class="week-grid__confirm-actions">
							<button
								class="week-grid__btn week-grid__btn--danger"
								@click="confirmClear"
							>
								Oui, effacer
							</button>
							<button
								class="week-grid__btn"
								@click="showClearConfirm = false"
							>
								Annuler
							</button>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import type { MealSlot, Recipe } from '@/stores/mealplanner'
import { DIET_LABELS } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'
import { useClaude } from '@/composables/useClaude'
import MealCell from './MealCell.vue'
import MealSelectPanel from './MealSelectPanel.vue'
import WeekSummaryBar from './WeekSummaryBar.vue'

const store = useMealPlannerStore()
const claude = useClaude()

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']

// ── État du panneau de sélection ──────────────

const panelOpen = ref(false)
const activeDay = ref<string>(store.DAYS[0])
const activeSlot = ref<MealSlot>('lunch')

function openSelectPanel(day: string, slot: MealSlot) {
	activeDay.value = day
	activeSlot.value = slot
	panelOpen.value = true
}

function handleRecipeSelected(recipe: Recipe) {
	// Ajoute la recette à la base si elle vient de Claude
	if (recipe.origin === 'claude') {
		const exists = store.recipes.find(r => r.id === recipe.id)
		if (!exists) {
			store.addRecipe({
				name: recipe.name,
				slot: recipe.slot,
				diet: recipe.diet,
				tags: recipe.tags,
				calories: recipe.calories,
				prepTime: recipe.prepTime,
				cookTime: recipe.cookTime,
				servings: recipe.servings,
				ingredients: recipe.ingredients,
				steps: recipe.steps,
				origin: 'claude',
				rating: recipe.rating,
				notes: recipe.notes,
			})
		}
	}
	store.assignMeal(activeDay.value, activeSlot.value, recipe)
}

// ── Génération de la semaine ──────────────────

async function handleGenerateWeek() {
	// Construire la map des repas verrouillés
	const lockedMeals: Partial<Record<string, Partial<Record<MealSlot, import('@/stores/mealplanner').PlannedMeal>>>> = {}

	for (const day of store.DAYS) {
		const dayPlan = store.weekPlan.days[day]
		for (const slot of SLOTS) {
			const meal = dayPlan?.[slot]
			if (meal?.locked) {
				if (!lockedMeals[day]) lockedMeals[day] = {}
				lockedMeals[day]![slot] = meal
			}
		}
	}

	const weekResult = await claude.generateWeek({
		existingRecipes: store.recipes,
		lockedMeals,
	})

	// Appliquer les repas générés
	for (const [day, slots] of Object.entries(weekResult)) {
		if (!slots) continue
		for (const [slot, recipe] of Object.entries(slots)) {
			if (!recipe) continue

			// Sauvegarder dans la base si pas déjà présent
			const exists = store.recipes.find(r => r.name === recipe.name)
			let finalRecipe = exists ?? recipe

			if (!exists) {
				finalRecipe = store.addRecipe({
					name: recipe.name,
					slot: recipe.slot,
					diet: recipe.diet,
					tags: recipe.tags,
					calories: recipe.calories,
					prepTime: recipe.prepTime,
					cookTime: recipe.cookTime,
					servings: recipe.servings,
					ingredients: recipe.ingredients,
					steps: recipe.steps,
					origin: 'claude',
					rating: recipe.rating,
					notes: recipe.notes,
				})
			}

			store.assignMeal(day, slot as MealSlot, finalRecipe)
		}
	}
}

// ── Effacement ────────────────────────────────

const showClearConfirm = ref(false)

function handleClearWeek() {
	showClearConfirm.value = true
}

function confirmClear() {
	store.clearWeek()
	showClearConfirm.value = false
}

// ── Helpers ───────────────────────────────────

function formatWeekStart(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}
</script>

<style lang="scss" scoped>
.week-grid {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

// ── TOOLBAR ───────────────────────────────────

.week-grid__toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
}

.week-grid__nav {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.week-grid__nav-btn {
	background: var(--grey-100, #f5f5f5);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	inline-size: 2rem;
	block-size: 2rem;
	font-size: 1.2rem;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.15s;

	&:hover {
		background: var(--grey-200, #e8e8e8);
	}
}

.week-grid__week-label {
	font-size: 0.9rem;
	font-weight: 600;
	color: var(--text, #333333);
}

.week-grid__actions {
	display: flex;
	gap: 0.5rem;
}

.week-grid__btn {
	padding: 0.45rem 0.9rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: var(--white, #ffffff);
	font-size: 0.85rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;

	&:hover {
		background: var(--grey-100, #f5f5f5);
	}

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover:not(:disabled) {
			background: var(--primary-dark, #1560d4);
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	&--danger {
		color: var(--danger, #e53e3e);

		&:hover {
			background: rgba(229, 62, 62, 0.08);
			border-color: var(--danger, #e53e3e);
		}
	}
}

// ── GRILLE ────────────────────────────────────

.week-grid__grid {
	display: grid;
	// 1 colonne label + 7 colonnes jours
	grid-template-columns: 90px repeat(7, 1fr);
	gap: 0.5rem;
	overflow-x: auto;
	min-inline-size: 0;
}

.week-grid__corner {
	// cellule vide en haut à gauche
}

.week-grid__day-header {
	text-align: center;
	padding: 0.5rem 0.25rem;
	border-radius: 8px;
	background: var(--grey-100, #f5f5f5);

	&.diet-header--vegan {
		background: #d1fae5;
	}

	&.diet-header--fish {
		background: #dbeafe;
	}

	&.diet-header--all {
		background: #eec215;
	}
}

.week-grid__day-name {
	display: block;
	font-weight: 700;
	font-size: 0.85rem;
	color: var(--text, #333333);
}

.week-grid__day-diet {
	display: block;
	font-size: 0.7rem;
	color: var(--grey-600, #666666);
	margin-block-start: 0.1rem;
}

.week-grid__slot-label {
	display: flex;
	align-items: center;
	font-size: 0.78rem;
	font-weight: 600;
	color: var(--grey-500, #888888);
	padding-inline-end: 0.5rem;
}

// ── CONFIRMATION ──────────────────────────────

.week-grid__confirm-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
}

.week-grid__confirm-card {
	background: white;
	border-radius: 16px;
	padding: 1.5rem 2rem;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	display: flex;
	flex-direction: column;
	gap: 1rem;
	max-inline-size: 340px;
	inline-size: 90%;

	p {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text, #333333);
		margin: 0;
		text-align: center;
	}
}

.week-grid__confirm-actions {
	display: flex;
	gap: 0.5rem;
	justify-content: center;
}

// ── TRANSITION FADE ───────────────────────────

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>