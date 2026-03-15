<template>
	<Teleport to="body">
		<Transition name="panel">
			<div
				v-if="isOpen"
				class="meal-select-panel"
			>
				<!-- Overlay -->
				<div
					class="meal-select-panel__overlay"
					@click="close"
				/>

				<!-- Panneau -->
				<div class="meal-select-panel__drawer">
					<!-- Header -->
					<div class="meal-select-panel__header">
						<div class="meal-select-panel__header-info">
							<h3 class="meal-select-panel__title">
								Choisir un repas
							</h3>
							<p class="meal-select-panel__subtitle">
								{{ slotLabel }} —
								<span :class="`diet-text--${dayDiet}`">
									{{ DIET_LABELS[dayDiet] }}
								</span>
							</p>
						</div>
						<button
							class="meal-select-panel__close"
							@click="close"
						>
							✕
						</button>
					</div>

					<!-- Onglets -->
					<div class="meal-select-panel__tabs">
						<button
							class="meal-select-panel__tab"
							:class="{ 'is-active': activeTab === 'library' }"
							@click="activeTab = 'library'"
						>
							📖 Ma base ({{ filteredRecipes.length }})
						</button>
						<button
							class="meal-select-panel__tab"
							:class="{ 'is-active': activeTab === 'claude' }"
							@click="handleClaudeTab"
						>
							🤖 Suggestions Claude
						</button>
					</div>

					<!-- Recherche (onglet library) -->
					<div
						v-if="activeTab === 'library'"
						class="meal-select-panel__search"
					>
						<input
							v-model="searchQuery"
							type="text"
							placeholder="Rechercher une recette..."
							class="meal-select-panel__search-input"
						/>
					</div>

					<!-- Contenu -->
					<div class="meal-select-panel__body">
						<!-- Onglet Ma base -->
						<template v-if="activeTab === 'library'">
							<p
								v-if="filteredRecipes.length === 0"
								class="meal-select-panel__empty"
							>
								Aucune recette compatible avec les contraintes du jour.
								<br>
								<button
									class="meal-select-panel__link"
									@click="activeTab = 'claude'"
								>
									Demander à Claude →
								</button>
							</p>

							<div
								v-for="recipe in filteredRecipes"
								:key="recipe.id"
								class="meal-select-panel__recipe-card"
								@click="selectRecipe(recipe)"
							>
								<div class="meal-select-panel__recipe-header">
									<span
										class="meal-select-panel__recipe-badge"
										:class="`diet--${recipe.diet}`"
									>
										{{ DIET_LABELS[recipe.diet] }}
									</span>
									<span class="meal-select-panel__recipe-rating">
										{{ '⭐'.repeat(recipe.rating) }}
									</span>
								</div>
								<p class="meal-select-panel__recipe-name">{{ recipe.name }}</p>
								<p class="meal-select-panel__recipe-meta">
									🔥 {{ recipe.calories }} kcal
									· ⏱ {{ recipe.prepTime + recipe.cookTime }} min
									<span v-if="recipe.lastUsed">
										· Dernier : {{ formatDate(recipe.lastUsed) }}
									</span>
								</p>
							</div>
						</template>

						<!-- Onglet Suggestions Claude -->
						<template v-else-if="activeTab === 'claude'">
							<!-- Chargement -->
							<div
								v-if="claudeLoading"
								class="meal-select-panel__loading"
							>
								<div class="meal-select-panel__spinner" />
								<p>Claude réfléchit...</p>
							</div>

							<!-- Erreur -->
							<p
								v-else-if="claudeError"
								class="meal-select-panel__error"
							>
								{{ claudeError }}
							</p>

							<!-- Suggestions -->
							<template v-else>
								<div
									v-for="recipe in claudeSuggestions"
									:key="recipe.id"
									class="meal-select-panel__recipe-card meal-select-panel__recipe-card--claude"
									@click="selectRecipe(recipe)"
								>
									<div class="meal-select-panel__recipe-header">
										<span
											class="meal-select-panel__recipe-badge"
											:class="`diet--${recipe.diet}`"
										>
											{{ DIET_LABELS[recipe.diet] }}
										</span>
										<span class="meal-select-panel__claude-badge">🤖 Claude</span>
									</div>
									<p class="meal-select-panel__recipe-name">{{ recipe.name }}</p>
									<p class="meal-select-panel__recipe-meta">
										🔥 {{ recipe.calories }} kcal
										· ⏱ {{ recipe.prepTime + recipe.cookTime }} min
									</p>
									<p
										v-if="recipe.notes"
										class="meal-select-panel__recipe-notes"
									>
										{{ recipe.notes }}
									</p>
								</div>

								<button
									v-if="claudeSuggestions.length > 0"
									class="meal-select-panel__refresh"
									@click="loadClaudeSuggestions"
								>
									🔄 Nouvelles suggestions
								</button>
							</template>
						</template>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
/**
 * CONCEPTS VUE UTILISÉS ICI :
 *
 * <Teleport to="body"> → monte le composant directement dans le <body>
 * du DOM, même si le composant est imbriqué profondément dans l'arbre Vue.
 * Indispensable pour les modales/panneaux pour éviter les problèmes
 * de z-index et d'overflow:hidden des parents.
 *
 * watch() → surveille une valeur réactive et exécute une fonction quand elle change
 */

import { ref, computed, watch } from 'vue'
import type { Recipe, MealSlot } from '@/stores/mealplanner'
import { DIET_LABELS, SLOTS_FR } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'
import { useClaude } from '@/composables/useClaude'

// ── PROPS & EMITS ─────────────────────────────

const props = defineProps<{
	isOpen: boolean
	day: string
	slot: MealSlot
}>()

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'select', recipe: Recipe): void
}>()

// ── STATE ─────────────────────────────────────

const store = useMealPlannerStore()
const claude = useClaude()

const activeTab = ref<'library' | 'claude'>('library')
const searchQuery = ref('')
const claudeSuggestions = ref<Recipe[]>([])
const claudeLoading = ref(false)
const claudeError = ref<string | null>(null)

// ── COMPUTED ──────────────────────────────────

const dayDiet = computed(() =>
	store.constraints.days[props.day]?.diet ?? 'all'
)

const slotLabel = computed(() => SLOTS_FR[props.slot])

/** Recettes filtrées par contrainte du jour + recherche */
const filteredRecipes = computed(() => {
	return store.recipes.filter(recipe => {
		// Filtre régime
		const diet = dayDiet.value
		if (diet === 'vegan' && recipe.diet !== 'vegan') return false
		if (diet === 'fish' && recipe.diet === 'all') return false

		// Filtre slot
		if (recipe.slot !== 'any' && recipe.slot !== props.slot) return false

		// Filtre calories
		if (recipe.calories > store.constraints.global.maxCalPerMeal) return false

		// Filtre recherche
		if (searchQuery.value) {
			const q = searchQuery.value.toLowerCase()
			return (
				recipe.name.toLowerCase().includes(q) ||
				recipe.tags.some(t => t.toLowerCase().includes(q)) ||
				recipe.ingredients.some(i => i.name.toLowerCase().includes(q))
			)
		}

		return true
	})
})

// ── WATCHERS ──────────────────────────────────

// Réinitialise quand le panneau s'ouvre sur un nouveau slot
watch(() => [props.isOpen, props.day, props.slot], ([isOpen]) => {
	if (isOpen) {
		activeTab.value = 'library'
		searchQuery.value = ''
		claudeSuggestions.value = []
		claudeError.value = null
	}
})

// ── ACTIONS ───────────────────────────────────

function close() {
	emit('close')
}

function selectRecipe(recipe: Recipe) {
	emit('select', recipe)
	close()
}

async function loadClaudeSuggestions() {
	claudeLoading.value = true
	claudeError.value = null

	const suggestions = await claude.suggestMeals({
		day: props.day,
		slot: props.slot,
		count: 3,
	})

	claudeLoading.value = false

	if (claude.error.value) {
		claudeError.value = claude.error.value
	} else {
		claudeSuggestions.value = suggestions
	}
}

function handleClaudeTab() {
	activeTab.value = 'claude'
	if (claudeSuggestions.value.length === 0) {
		loadClaudeSuggestions()
	}
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'short',
	})
}
</script>

<style lang="scss" scoped>
.meal-select-panel {
	position: fixed;
	inset: 0;
	z-index: 1000;
}

.meal-select-panel__overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
}

.meal-select-panel__drawer {
	position: absolute;
	inset-block: 0;
	inset-inline-end: 0;
	width: min(420px, 100vw);
	background: var(--white, #fff);
	display: flex;
	flex-direction: column;
	box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
	overflow: hidden;
}

// ── HEADER ────────────────────────────────────

.meal-select-panel__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding: 1.25rem 1.25rem 1rem;
	border-bottom: 1px solid var(--grey-200, #e8e8e8);
	flex-shrink: 0;
}

.meal-select-panel__title {
	font-size: 1.1rem;
	font-weight: 700;
	margin: 0 0 0.2rem;
	color: var(--text, #333);
}

.meal-select-panel__subtitle {
	font-size: 0.85rem;
	color: var(--grey-500, #888);
	margin: 0;
}

.meal-select-panel__close {
	background: none;
	border: none;
	font-size: 1rem;
	cursor: pointer;
	padding: 0.25rem 0.5rem;
	border-radius: 6px;
	color: var(--grey-500, #888);
	transition: background 0.15s;

	&:hover {
		background: var(--grey-100, #f5f5f5);
		color: var(--text, #333);
	}
}

// ── ONGLETS ───────────────────────────────────

.meal-select-panel__tabs {
	display: flex;
	border-bottom: 1px solid var(--grey-200, #e8e8e8);
	flex-shrink: 0;
}

.meal-select-panel__tab {
	flex: 1;
	padding: 0.75rem;
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	cursor: pointer;
	font-size: 0.85rem;
	font-weight: 500;
	color: var(--grey-500, #888);
	transition: color 0.15s, border-color 0.15s;

	&.is-active {
		color: var(--primary, #1973ff);
		border-bottom-color: var(--primary, #1973ff);
	}

	&:hover:not(.is-active) {
		color: var(--text, #333);
	}
}

// ── RECHERCHE ─────────────────────────────────

.meal-select-panel__search {
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--grey-100, #f5f5f5);
	flex-shrink: 0;
}

.meal-select-panel__search-input {
	width: 100%;
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	background: var(--grey-50, #fafafa);
	outline: none;
	transition: border-color 0.15s;
	box-sizing: border-box;

	&:focus {
		border-color: var(--primary, #1973ff);
		background: white;
	}
}

// ── BODY ──────────────────────────────────────

.meal-select-panel__body {
	flex: 1;
	overflow-y: auto;
	padding: 0.75rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

// ── CARTES RECETTES ───────────────────────────

.meal-select-panel__recipe-card {
	padding: 0.8rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 10px;
	cursor: pointer;
	transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;

	&:hover {
		border-color: var(--primary, #1973ff);
		box-shadow: 0 2px 8px rgba(25, 115, 255, 0.1);
		transform: translateY(-1px);
	}

	&--claude {
		border-color: var(--grey-300, #ddd);
		background: var(--grey-50, #fafafa);
	}
}

.meal-select-panel__recipe-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.35rem;
}

.meal-select-panel__recipe-badge {
	font-size: 0.65rem;
	font-weight: 600;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;

	&.diet--vegan { background: #d1fae5; color: #065f46; }
	&.diet--fish  { background: #dbeafe; color: #1e40af; }
	&.diet--all   { background: #eec215; color: #92400e; }
}

.meal-select-panel__recipe-rating {
	font-size: 0.7rem;
}

.meal-select-panel__claude-badge {
	font-size: 0.65rem;
	background: #f3e8ff;
	color: #6b21a8;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;
	font-weight: 600;
}

.meal-select-panel__recipe-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--text, #333);
	margin: 0 0 0.2rem;
}

.meal-select-panel__recipe-meta {
	font-size: 0.75rem;
	color: var(--grey-500, #888);
	margin: 0;
}

.meal-select-panel__recipe-notes {
	font-size: 0.75rem;
	color: var(--grey-600, #666);
	margin: 0.3rem 0 0;
	font-style: italic;
}

// ── ÉTATS ─────────────────────────────────────

.meal-select-panel__empty {
	text-align: center;
	color: var(--grey-500, #888);
	font-size: 0.875rem;
	padding: 2rem 0;
}

.meal-select-panel__link {
	background: none;
	border: none;
	color: var(--primary, #1973ff);
	cursor: pointer;
	font-size: 0.875rem;
	text-decoration: underline;
	margin-top: 0.5rem;
}

.meal-select-panel__loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	padding: 2rem;
	color: var(--grey-500, #888);
	font-size: 0.875rem;
}

.meal-select-panel__spinner {
	width: 2rem;
	height: 2rem;
	border: 2px solid var(--grey-200, #e8e8e8);
	border-top-color: var(--primary, #1973ff);
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

.meal-select-panel__error {
	color: var(--danger, #e53e3e);
	font-size: 0.875rem;
	padding: 1rem;
	background: rgba(229, 62, 62, 0.05);
	border-radius: 8px;
}

.meal-select-panel__refresh {
	width: 100%;
	padding: 0.6rem;
	background: var(--grey-100, #f5f5f5);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	cursor: pointer;
	font-size: 0.85rem;
	color: var(--grey-600, #666);
	transition: background 0.15s;
	margin-top: 0.25rem;

	&:hover {
		background: var(--grey-200, #e8e8e8);
	}
}

// ── BADGES RÉGIME (texte) ─────────────────────

.diet-text--vegan { color: #065f46; font-weight: 600; }
.diet-text--fish  { color: #1e40af; font-weight: 600; }
.diet-text--all   { color: #92400e; font-weight: 600; }

// ── TRANSITION ────────────────────────────────

.panel-enter-active,
.panel-leave-active {
	transition: opacity 0.2s ease;

	.meal-select-panel__drawer {
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}
}

.panel-enter-from,
.panel-leave-to {
	opacity: 0;

	.meal-select-panel__drawer {
		transform: translateX(100%);
	}
}

@keyframes spin {
	to { transform: rotate(360deg); }
}
</style>