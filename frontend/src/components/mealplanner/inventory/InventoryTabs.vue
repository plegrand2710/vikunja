<template>
	<div class="inventory-tabs">
		<!-- Onglets + actions -->
		<div class="inventory-tabs__header">
			<div class="inventory-tabs__tabs">
				<button
					class="inventory-tabs__tab"
					:class="{ 'is-active': activeTab === 'fridge' }"
					@click="activeTab = 'fridge'"
				>
					🧊 Frigo
					<span class="inventory-tabs__count">{{ store.fridgeItems.length }}</span>
				</button>
				<button
					class="inventory-tabs__tab"
					:class="{ 'is-active': activeTab === 'pantry' }"
					@click="activeTab = 'pantry'"
				>
					🗄️ Placard
					<span class="inventory-tabs__count">{{ store.pantryItems.length }}</span>
				</button>
			</div>

			<!-- Bouton suggestion Claude -->
			<button
				class="inventory-tabs__claude-btn"
				:disabled="store.isLoading || store.inventory.length === 0"
				@click="handleSuggestFromInventory"
			>
				🍳 Que puis-je cuisiner ?
			</button>
		</div>

		<!-- Ajout rapide -->
		<div class="inventory-tabs__add">
			<QuickAddInput
				:location="activeTab"
				:placeholder="activeTab === 'fridge' ? 'ex: 500g poulet, 3 courgettes...' : 'ex: 400g pâtes, 1L huile...'"
			/>
		</div>

		<!-- Filtre catégorie -->
		<div class="inventory-tabs__filters">
			<button
				class="inventory-tabs__filter-btn"
				:class="{ 'is-active': selectedCategory === null }"
				@click="selectedCategory = null"
			>
				Tout
			</button>
			<button
				v-for="cat in availableCategories"
				:key="cat"
				class="inventory-tabs__filter-btn"
				:class="{ 'is-active': selectedCategory === cat }"
				@click="selectedCategory = cat"
			>
				{{ categoryEmoji[cat] }} {{ cat }}
			</button>
		</div>

		<!-- Liste des items -->
		<div class="inventory-tabs__list">
			<!-- En-tête colonnes -->
			<div class="inventory-tabs__list-header">
				<span />
				<span>Nom</span>
				<span>Quantité</span>
				<span>Péremption</span>
				<span />
			</div>

			<!-- Items -->
			<template v-if="filteredItems.length > 0">
				<InventoryItemComponent
					v-for="item in filteredItems"
					:key="item.id"
					:item="item"
					@remove="store.removeInventoryItem"
				/>
			</template>
			<p
				v-else
				class="inventory-tabs__empty"
			>
				{{ activeTab === 'fridge' ? '🧊' : '🗄️' }}
				Aucun ingrédient dans {{ activeTab === 'fridge' ? 'le frigo' : 'le placard' }}.
			</p>
		</div>

		<!-- Suggestions Claude (modal inline) -->
		<Transition name="suggestions">
			<div
				v-if="claudeSuggestions.length > 0"
				class="inventory-tabs__suggestions"
			>
				<div class="inventory-tabs__suggestions-header">
					<h4>🤖 Suggestions de Claude</h4>
					<button
						class="inventory-tabs__suggestions-close"
						@click="claudeSuggestions = []"
					>
						✕
					</button>
				</div>
				<div class="inventory-tabs__suggestions-list">
					<div
						v-for="recipe in claudeSuggestions"
						:key="recipe.id"
						class="inventory-tabs__suggestion-card"
					>
						<div class="inventory-tabs__suggestion-header">
							<span
								class="inventory-tabs__suggestion-badge"
								:class="`diet--${recipe.diet}`"
							>
								{{ DIET_LABELS[recipe.diet] }}
							</span>
							<span class="inventory-tabs__suggestion-cal">
								🔥 {{ recipe.calories }} kcal
							</span>
						</div>
						<p class="inventory-tabs__suggestion-name">{{ recipe.name }}</p>
						<p class="inventory-tabs__suggestion-meta">
							⏱ {{ recipe.prepTime + recipe.cookTime }} min
						</p>
						<button
							class="inventory-tabs__suggestion-save"
							@click="saveAndClose(recipe)"
						>
							+ Ajouter à la base
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import type { Recipe, IngredientCategory } from '@/stores/mealplanner'
import { DIET_LABELS } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'
import { useClaude } from '@/composables/useClaude'
import QuickAddInput from './QuickAddInput.vue'
import InventoryItemComponent from './InventoryItem.vue'

const store = useMealPlannerStore()
const claude = useClaude()

const activeTab = ref<'fridge' | 'pantry'>('fridge')
const selectedCategory = ref<IngredientCategory | null>(null)
const claudeSuggestions = ref<Recipe[]>([])

const categoryEmoji: Record<string, string> = {
	'légume': '🥦',
	'fruit': '🍎',
	'viande': '🥩',
	'poisson': '🐟',
	'féculent': '🍞',
	'produit laitier': '🧀',
	'épice': '🧂',
	'autre': '📦',
}

// Items de l'onglet actif
const currentItems = computed(() =>
	activeTab.value === 'fridge' ? store.fridgeItems : store.pantryItems
)

// Catégories présentes dans l'onglet actif
const availableCategories = computed(() => {
	const cats = new Set(currentItems.value.map(i => i.category))
	return [...cats] as IngredientCategory[]
})

// Items filtrés par catégorie
const filteredItems = computed(() => {
	if (!selectedCategory.value) return currentItems.value
	return currentItems.value.filter(i => i.category === selectedCategory.value)
})

// Suggestions Claude depuis l'inventaire
async function handleSuggestFromInventory() {
	// Utilise les contraintes du jour courant (lundi par défaut)
	const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
	const day = store.DAYS.includes(today as typeof store.DAYS[number]) ? today : 'monday'

	const suggestions = await claude.suggestFromInventory(day)
	claudeSuggestions.value = suggestions
}

function saveAndClose(recipe: Recipe) {
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
	claudeSuggestions.value = claudeSuggestions.value.filter(r => r.id !== recipe.id)
}
</script>

<style lang="scss" scoped>
.inventory-tabs {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	max-width: 900px;
}

// ── Header ────────────────────────────────────

.inventory-tabs__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
}

.inventory-tabs__tabs {
	display: flex;
	gap: 0.25rem;
	background: var(--grey-100, #f5f5f5);
	padding: 0.25rem;
	border-radius: 10px;
}

.inventory-tabs__tab {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.4rem 0.9rem;
	border-radius: 8px;
	border: none;
	background: transparent;
	cursor: pointer;
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--grey-600, #666);
	transition: background 0.15s, color 0.15s;

	&.is-active {
		background: white;
		color: var(--text, #333);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	}
}

.inventory-tabs__count {
	background: var(--grey-200, #e8e8e8);
	color: var(--grey-600, #666);
	font-size: 0.7rem;
	font-weight: 700;
	padding: 0.1rem 0.4rem;
	border-radius: 999px;

	.inventory-tabs__tab.is-active & {
		background: var(--primary-light, #e8f0ff);
		color: var(--primary, #1973ff);
	}
}

.inventory-tabs__claude-btn {
	padding: 0.45rem 0.9rem;
	background: var(--white, #fff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.85rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;

	&:hover:not(:disabled) {
		border-color: var(--primary, #1973ff);
		background: var(--primary-light, #e8f0ff);
		color: var(--primary, #1973ff);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

// ── Ajout rapide ──────────────────────────────

.inventory-tabs__add {
	background: var(--white, #fff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	padding: 1rem;
}

// ── Filtres catégorie ─────────────────────────

.inventory-tabs__filters {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35rem;
}

.inventory-tabs__filter-btn {
	padding: 0.25rem 0.6rem;
	border-radius: 999px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: var(--white, #fff);
	font-size: 0.78rem;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;

	&:hover {
		background: var(--grey-100, #f5f5f5);
	}

	&.is-active {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);
	}
}

// ── Liste ─────────────────────────────────────

.inventory-tabs__list {
	background: var(--white, #fff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	overflow: hidden;
}

.inventory-tabs__list-header {
	display: grid;
	grid-template-columns: 2rem 1fr 100px 110px 70px;
	gap: 0.75rem;
	padding: 0.6rem 0.75rem;
	background: var(--grey-50, #fafafa);
	border-bottom: 1px solid var(--grey-200, #e8e8e8);
	font-size: 0.72rem;
	font-weight: 600;
	color: var(--grey-500, #888);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.inventory-tabs__empty {
	text-align: center;
	color: var(--grey-400, #bbb);
	font-size: 0.875rem;
	padding: 2.5rem;
	margin: 0;
}

// ── Suggestions Claude ────────────────────────

.inventory-tabs__suggestions {
	background: var(--white, #fff);
	border: 1px solid var(--primary, #1973ff);
	border-radius: 12px;
	overflow: hidden;
}

.inventory-tabs__suggestions-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 1rem;
	background: var(--primary-light, #e8f0ff);
	border-bottom: 1px solid var(--primary, #1973ff);

	h4 {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--primary, #1973ff);
		margin: 0;
	}
}

.inventory-tabs__suggestions-close {
	background: none;
	border: none;
	color: var(--primary, #1973ff);
	cursor: pointer;
	font-size: 0.85rem;
	padding: 0.2rem 0.4rem;
	border-radius: 4px;

	&:hover {
		background: rgba(25, 115, 255, 0.1);
	}
}

.inventory-tabs__suggestions-list {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	gap: 0.75rem;
	padding: 0.75rem;
}

.inventory-tabs__suggestion-card {
	padding: 0.8rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 10px;
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
}

.inventory-tabs__suggestion-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.inventory-tabs__suggestion-badge {
	font-size: 0.65rem;
	font-weight: 600;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;

	&.diet--vegan { background: #d1fae5; color: #065f46; }
	&.diet--fish  { background: #dbeafe; color: #1e40af; }
	&.diet--all   { background: #eec215; color: #92400e; }
}

.inventory-tabs__suggestion-cal {
	font-size: 0.72rem;
	color: var(--grey-500, #888);
}

.inventory-tabs__suggestion-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--text, #333);
	margin: 0;
}

.inventory-tabs__suggestion-meta {
	font-size: 0.75rem;
	color: var(--grey-500, #888);
	margin: 0;
}

.inventory-tabs__suggestion-save {
	margin-top: 0.25rem;
	padding: 0.35rem 0.6rem;
	border: 1px solid var(--primary, #1973ff);
	border-radius: 6px;
	background: transparent;
	color: var(--primary, #1973ff);
	font-size: 0.78rem;
	cursor: pointer;
	transition: background 0.15s;

	&:hover {
		background: var(--primary-light, #e8f0ff);
	}
}

// ── Transition suggestions ────────────────────

.suggestions-enter-active,
.suggestions-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.suggestions-enter-from,
.suggestions-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}
</style>