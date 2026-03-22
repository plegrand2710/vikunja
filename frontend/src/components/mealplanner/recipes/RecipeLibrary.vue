<template>
	<div class="recipe-library">
		<!-- Toolbar -->
		<div class="recipe-library__toolbar">
			<!-- Recherche -->
			<input
				v-model="searchQuery"
				type="text"
				placeholder="🔍 Rechercher (nom, ingrédient, tag...)"
				class="recipe-library__search"
			>

			<!-- Actions -->
			<div class="recipe-library__actions">
				<button
					class="recipe-library__btn recipe-library__btn--primary"
					@click="showForm = true"
				>
					+ Ajouter
				</button>
				<button
					class="recipe-library__view-btn"
					:class="{ 'is-active': viewMode === 'grid' }"
					title="Vue grille"
					@click="viewMode = 'grid'"
				>
					▦
				</button>
				<button
					class="recipe-library__view-btn"
					:class="{ 'is-active': viewMode === 'list' }"
					title="Vue liste"
					@click="viewMode = 'list'"
				>
					☰
				</button>
			</div>
		</div>

		<!-- Filtres -->
		<div class="recipe-library__filters">
			<!-- Régime -->
			<div class="recipe-library__filter-group">
				<button
					class="recipe-library__filter-btn"
					:class="{ 'is-active': filterDiet === null }"
					@click="filterDiet = null"
				>
					Tous
				</button>
				<button
					v-for="diet in DIETS"
					:key="diet.value"
					class="recipe-library__filter-btn"
					:class="{ 'is-active': filterDiet === diet.value }"
					@click="filterDiet = diet.value"
				>
					{{ diet.label }}
				</button>
			</div>

			<!-- Tri -->
			<select
				v-model="sortBy"
				class="recipe-library__sort"
			>
				<option value="recent">
					Plus récents
				</option>
				<option value="usage">
					Plus utilisés
				</option>
				<option value="rating">
					Mieux notés
				</option>
				<option value="alpha">
					Alphabétique
				</option>
				<option value="calories_asc">
					Calories ↑
				</option>
				<option value="calories_desc">
					Calories ↓
				</option>
			</select>

			<!-- Filtre inventaire -->
			<button
				class="recipe-library__inventory-filter"
				:class="{ 'is-active': filterCookable }"
				@click="filterCookable = !filterCookable"
			>
				🧊 Faisable avec mon inventaire
				<span class="recipe-library__cookable-count">
					{{ store.cookableRecipes.length }}
				</span>
			</button>
		</div>

		<!-- Compteur -->
		<p class="recipe-library__count">
			{{ filteredRecipes.length }} recette(s)
			<span v-if="searchQuery || filterDiet || filterCookable">
				(filtrées sur {{ store.recipes.length }})
			</span>
		</p>

		<!-- Grille ou liste -->
		<div
			class="recipe-library__content"
			:class="`is-${viewMode}`"
		>
			<p
				v-if="filteredRecipes.length === 0"
				class="recipe-library__empty"
			>
				Aucune recette trouvée.
				<button
					class="recipe-library__link"
					@click="showForm = true"
				>
					Ajouter la première →
				</button>
			</p>

			<RecipeCard
				v-for="recipe in filteredRecipes"
				:key="recipe.id"
				:recipe="recipe"
				@click="openDetail"
			/>
		</div>

		<!-- Panneau détail -->
		<RecipeDetail
			:recipe="selectedRecipe"
			@close="selectedRecipe = null"
			@plan="handlePlan"
			@edit="handleEdit"
			@deleted="selectedRecipe = null"
		/>

		<!-- Formulaire ajout/édition -->
		<RecipeForm
			:is-open="showForm"
			:edit-recipe="editingRecipe"
			@close="closeForm"
			@saved="handleSaved"
		/>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import type { Recipe, DietType } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'
import RecipeCard from './RecipeCard.vue'
import RecipeDetail from './RecipeDetail.vue'
import RecipeForm from './RecipeForm.vue'

const store = useMealPlannerStore()

// ── État local ────────────────────────────────

const searchQuery = ref('')
const filterDiet = ref<DietType | null>(null)
const filterCookable = ref(false)
const sortBy = ref<'recent' | 'usage' | 'rating' | 'alpha' | 'calories_asc' | 'calories_desc'>('recent')
const viewMode = ref<'grid' | 'list'>('grid')

const selectedRecipe = ref<Recipe | null>(null)
const showForm = ref(false)
const editingRecipe = ref<Recipe | null>(null)

const DIETS = [
	{ value: 'vegan' as DietType, label: '🥦 Vegan' },
	{ value: 'fish' as DietType, label: '🐟 Poisson' },
	{ value: 'all' as DietType, label: '🍽️ Tout' },
]

// ── Recettes filtrées + triées ────────────────

const filteredRecipes = computed(() => {
	let list = [...store.recipes]

	// Filtre recherche
	if (searchQuery.value) {
		const q = searchQuery.value.toLowerCase()
		list = list.filter(r =>
			r.name.toLowerCase().includes(q) ||
			r.tags.some(t => t.toLowerCase().includes(q)) ||
			r.ingredients.some(i => i.name.toLowerCase().includes(q)),
		)
	}

	// Filtre régime
	if (filterDiet.value) {
		list = list.filter(r => r.diet === filterDiet.value)
	}

	// Filtre faisable
	if (filterCookable.value) {
		const cookableIds = new Set(store.cookableRecipes.map(r => r.id))
		list = list.filter(r => cookableIds.has(r.id))
	}

	// Tri
	list.sort((a, b) => {
		switch (sortBy.value) {
			case 'usage': return b.usageCount - a.usageCount
			case 'rating': return b.rating - a.rating
			case 'alpha': return a.name.localeCompare(b.name)
			case 'calories_asc': return a.calories - b.calories
			case 'calories_desc': return b.calories - a.calories
			case 'recent':
			default:
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		}
	})

	return list
})

// ── Handlers ──────────────────────────────────

function openDetail(id: string) {
	selectedRecipe.value = store.recipes.find(r => r.id === id) ?? null
}

function handlePlan(recipe: Recipe) {
	// Ouvre le planning et pré-sélectionne la recette
	store.setActiveSection('planning')
	selectedRecipe.value = null
}

function handleEdit(recipe: Recipe) {
	editingRecipe.value = recipe
	showForm.value = true
	selectedRecipe.value = null
}

function closeForm() {
	showForm.value = false
	editingRecipe.value = null
}

function handleSaved(recipe: Recipe) {
	// Ouvre le détail de la recette sauvegardée
	selectedRecipe.value = store.recipes.find(r => r.id === recipe.id) ?? null
}
</script>

<style lang="scss" scoped>
.recipe-library {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

// ── Toolbar ───────────────────────────────────

.recipe-library__toolbar {
	display: flex;
	gap: 0.75rem;
	align-items: center;
	flex-wrap: wrap;
}

.recipe-library__search {
	flex: 1;
	min-inline-size: 200px;
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	transition: border-color 0.15s;

	&:focus { border-color: var(--primary, #1973ff); }
}

.recipe-library__actions {
	display: flex;
	gap: 0.4rem;
	align-items: center;
}

.recipe-library__btn {
	padding: 0.45rem 0.9rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.85rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;

	&:hover { background: var(--grey-100, #f5f5f5); }

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover { background: var(--primary-dark, #1560d4); }
	}
}

.recipe-library__view-btn {
	padding: 0.4rem 0.6rem;
	border-radius: 6px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 1rem;
	cursor: pointer;
	transition: background 0.15s;

	&:hover { background: var(--grey-100, #f5f5f5); }
	&.is-active {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);
	}
}

// ── Filtres ───────────────────────────────────

.recipe-library__filters {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.recipe-library__filter-group {
	display: flex;
	gap: 0.25rem;
}

.recipe-library__filter-btn {
	padding: 0.3rem 0.65rem;
	border-radius: 999px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.8rem;
	cursor: pointer;
	transition: background 0.15s;

	&:hover { background: var(--grey-100, #f5f5f5); }
	&.is-active {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);
	}
}

.recipe-library__sort {
	padding: 0.3rem 0.6rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.8rem;
	outline: none;
	background: white;
}

.recipe-library__inventory-filter {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.3rem 0.65rem;
	border-radius: 999px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.8rem;
	cursor: pointer;
	transition: background 0.15s;

	&:hover { background: var(--grey-100, #f5f5f5); }
	&.is-active {
		background: #d1fae5;
		color: #065f46;
		border-color: #10b981;
	}
}

.recipe-library__cookable-count {
	background: #10b981;
	color: white;
	font-size: 0.65rem;
	font-weight: 700;
	padding: 0.1rem 0.35rem;
	border-radius: 999px;
}

// ── Compteur ──────────────────────────────────

.recipe-library__count {
	font-size: 0.8rem;
	color: var(--grey-500, #888888);
	margin: 0;
}

// ── Contenu ───────────────────────────────────

.recipe-library__content {
	&.is-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	&.is-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
}

.recipe-library__empty {
	grid-column: 1 / -1;
	text-align: center;
	color: var(--grey-400, #bbbbbb);
	font-size: 0.875rem;
	padding: 3rem;
}

.recipe-library__link {
	background: none;
	border: none;
	color: var(--primary, #1973ff);
	cursor: pointer;
	font-size: 0.875rem;
	text-decoration: underline;
}
</style>