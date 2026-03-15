<template>
	<div class="meal-planner">
		<!-- Navigation interne (sous-sidebar) -->
		<aside class="meal-planner__sidebar">
			<div class="meal-planner__sidebar-header">
				<span class="meal-planner__sidebar-icon">🍽️</span>
				<h2 class="meal-planner__sidebar-title">FridgeFlow</h2>
			</div>

			<nav class="meal-planner__nav">
				<button
					v-for="section in sections"
					:key="section.id"
					class="meal-planner__nav-item"
					:class="{ 'is-active': store.activeSection === section.id }"
					@click="store.setActiveSection(section.id)"
				>
					<span class="meal-planner__nav-icon">{{ section.icon }}</span>
					<span class="meal-planner__nav-label">{{ section.label }}</span>
					<!-- Badge pour les items qui expirent bientôt -->
					<span
						v-if="section.id === 'inventory' && store.expiringItems.length > 0"
						class="meal-planner__nav-badge"
					>
						{{ store.expiringItems.length }}
					</span>
				</button>
			</nav>
		</aside>

		<!-- Contenu principal -->
		<main class="meal-planner__content">
			<!-- Overlay de chargement Claude -->
			<Transition name="fade">
				<div
					v-if="store.isLoading"
					class="meal-planner__loading-overlay"
				>
					<div class="meal-planner__loading-card">
						<div class="meal-planner__loading-spinner" />
						<p class="meal-planner__loading-message">
							{{ store.loadingMessage || 'Chargement...' }}
						</p>
					</div>
				</div>
			</Transition>

			<!-- Sections -->
			<Transition
				name="section"
				mode="out-in"
			>
				<!-- Planning semaine -->
				<section
					v-if="store.activeSection === 'planning'"
					key="planning"
					class="meal-planner__section"
				>
					<div class="meal-planner__section-header">
						<h1>📅 Planning de la semaine</h1>
						<p class="meal-planner__section-subtitle">
							Semaine du {{ formatWeekStart(store.weekPlan.weekStart) }}
						</p>
					</div>
					<WeekGrid />
				</section>

				<!-- Contraintes -->
				<section
					v-else-if="store.activeSection === 'constraints'"
					key="constraints"
					class="meal-planner__section"
				>
					<div class="meal-planner__section-header">
						<h1>⚙️ Contraintes & filtres</h1>
						<p class="meal-planner__section-subtitle">
							Définissez vos règles nutritionnelles
						</p>
					</div>
					<div class="meal-planner__constraints-layout">
						<GlobalConstraints />
						<DayConstraintsTable />
						<ConstraintProfiles />
					</div>
				</section>

				<!-- Inventaire -->
				<section
					v-else-if="store.activeSection === 'inventory'"
					key="inventory"
					class="meal-planner__section"
				>
					<div class="meal-planner__section-header">
						<h1>🧊 Inventaire</h1>
						<p class="meal-planner__section-subtitle">
							{{ store.inventory.length }} ingrédient(s) en stock
							<span
								v-if="store.expiringItems.length > 0"
								class="meal-planner__expiry-warning"
							>
								— ⚠️ {{ store.expiringItems.length }} proche(s) de péremption
							</span>
						</p>
					</div>
					<InventoryTabs />
				</section>

				<!-- Liste de courses -->
				<section
					v-else-if="store.activeSection === 'shopping'"
					key="shopping"
					class="meal-planner__section"
				>
					<div class="meal-planner__section-header">
						<h1>🛒 Liste de courses</h1>
						<p class="meal-planner__section-subtitle">
							{{ store.shoppingList.length }} article(s) à acheter
						</p>
					</div>
					<ShoppingList />
				</section>

				<!-- Base de menus -->
				<section
					v-else-if="store.activeSection === 'recipes'"
					key="recipes"
					class="meal-planner__section"
				>
					<div class="meal-planner__section-header">
						<h1>📖 Base de menus</h1>
						<p class="meal-planner__section-subtitle">
							{{ store.recipes.length }} recette(s) enregistrée(s)
						</p>
					</div>
					<RecipeLibrary />
				</section>
			</Transition>
		</main>
	</div>
</template>

<script lang="ts" setup>
/**
 * CONCEPTS VUE UTILISÉS ICI :
 *
 * <script setup> → syntaxe moderne de Vue 3, tout ce qui est déclaré
 * ici est automatiquement accessible dans le <template>
 *
 * useMealPlannerStore() → accède au store Pinia depuis n'importe quel composant
 *
 * <Transition> → composant Vue intégré pour animer les changements de section
 *
 * v-if / v-else-if → affichage conditionnel
 * v-for → boucle
 * :class → binding de classes dynamiques
 * @click → écoute d'événements
 */

import ShoppingList from '@/components/mealplanner/shopping/ShoppingList.vue'
import RecipeLibrary from '@/components/mealplanner/recipes/RecipeLibrary.vue'
import InventoryTabs from '@/components/mealplanner/inventory/InventoryTabs.vue'
import GlobalConstraints from '@/components/mealplanner/constraints/GlobalConstraints.vue'
import DayConstraintsTable from '@/components/mealplanner/constraints/DayConstraintsTable.vue'
import ConstraintProfiles from '@/components/mealplanner/constraints/ConstraintProfiles.vue'
import WeekGrid from '@/components/mealplanner/planning/WeekGrid.vue'
import { useMealPlannerStore } from '@/stores/mealplanner'

const store = useMealPlannerStore()

// Sections de navigation
const sections = [
	{ id: 'planning' as const, icon: '📅', label: 'Planning semaine' },
	{ id: 'constraints' as const, icon: '⚙️', label: 'Contraintes' },
	{ id: 'inventory' as const, icon: '🧊', label: 'Inventaire' },
	{ id: 'shopping' as const, icon: '🛒', label: 'Courses' },
	{ id: 'recipes' as const, icon: '📖', label: 'Base de menus' },
]

// Formate "2026-03-16" → "lundi 16 mars 2026"
function formatWeekStart(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}
</script>

<style lang="scss" scoped>
.meal-planner {
	display: flex;
	height: 100%;
	min-height: calc(100vh - var(--navbar-height, 4rem));
	background: var(--site-background);
}

.meal-planner__constraints-layout {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 900px;
}

// ── SIDEBAR ──────────────────────────────────

.meal-planner__sidebar {
	width: 220px;
	flex-shrink: 0;
	background: var(--grey-100, #f5f5f5);
	border-inline-end: 1px solid var(--grey-200, #e8e8e8);
	padding: 1.5rem 0;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.meal-planner__sidebar-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0 1.25rem 1rem;
	border-bottom: 1px solid var(--grey-200, #e8e8e8);
	margin-bottom: 0.5rem;
}

.meal-planner__sidebar-icon {
	font-size: 1.5rem;
}

.meal-planner__sidebar-title {
	font-size: 1.1rem;
	font-weight: 700;
	color: var(--text, #333);
	margin: 0;
}

.meal-planner__nav {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0 0.75rem;
}

.meal-planner__nav-item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.6rem 0.75rem;
	border-radius: 8px;
	border: none;
	background: transparent;
	cursor: pointer;
	width: 100%;
	text-align: start;
	font-size: 0.9rem;
	font-weight: 500;
	color: var(--text, #333);
	transition: background 0.15s ease, color 0.15s ease;
	position: relative;

	&:hover {
		background: var(--grey-200, #e8e8e8);
	}

	&.is-active {
		background: var(--primary, #1973ff);
		color: white;
	}
}

.meal-planner__nav-icon {
	font-size: 1.1rem;
	flex-shrink: 0;
}

.meal-planner__nav-label {
	flex: 1;
}

.meal-planner__nav-badge {
	background: var(--danger, #e53e3e);
	color: white;
	font-size: 0.7rem;
	font-weight: 700;
	border-radius: 999px;
	padding: 0.1rem 0.4rem;
	min-width: 1.2rem;
	text-align: center;

	.is-active & {
		background: rgba(255, 255, 255, 0.3);
	}
}

// ── CONTENU ───────────────────────────────────

.meal-planner__content {
	flex: 1;
	overflow-y: auto;
	padding: 2rem;
	position: relative;
}

.meal-planner__section {
	max-width: 1200px;
}

.meal-planner__section-header {
	margin-bottom: 2rem;

	h1 {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--text, #333);
		margin: 0 0 0.25rem;
	}
}

.meal-planner__section-subtitle {
	font-size: 0.9rem;
	color: var(--grey-500, #888);
	margin: 0;
}

.meal-planner__expiry-warning {
	color: var(--warning, #d97706);
	font-weight: 500;
}

// ── PLACEHOLDER (temporaire) ──────────────────

.meal-planner__placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1rem;
	padding: 4rem;
	border: 2px dashed var(--grey-300, #ddd);
	border-radius: 12px;
	color: var(--grey-500, #888);

	span {
		font-size: 3rem;
	}

	p {
		font-size: 1rem;
		font-weight: 500;
	}
}

// ── LOADING OVERLAY ───────────────────────────

.meal-planner__loading-overlay {
	position: absolute;
	inset: 0;
	background: rgba(255, 255, 255, 0.85);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
	backdrop-filter: blur(4px);
}

.meal-planner__loading-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	padding: 2rem 3rem;
	background: white;
	border-radius: 16px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.meal-planner__loading-spinner {
	width: 2.5rem;
	height: 2.5rem;
	border: 3px solid var(--grey-200, #e8e8e8);
	border-top-color: var(--primary, #1973ff);
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

.meal-planner__loading-message {
	font-size: 0.95rem;
	color: var(--grey-600, #666);
	font-weight: 500;
	margin: 0;
}

// ── TRANSITIONS ───────────────────────────────

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.section-enter-active,
.section-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}

.section-enter-from {
	opacity: 0;
	transform: translateX(8px);
}

.section-leave-to {
	opacity: 0;
	transform: translateX(-8px);
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

// ── RESPONSIVE ────────────────────────────────

@media screen and (max-width: 768px) {
	.meal-planner {
		flex-direction: column;
	}

	.meal-planner__sidebar {
		width: 100%;
		padding: 0.75rem;
	}

	.meal-planner__nav {
		flex-direction: row;
		overflow-x: auto;
		padding: 0;
	}

	.meal-planner__nav-item {
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		flex-shrink: 0;
		font-size: 0.75rem;
	}

	.meal-planner__content {
		padding: 1rem;
	}
}
</style>