<template>
	<Teleport to="body">
		<Transition name="panel">
			<div
				v-if="recipe"
				class="recipe-detail"
			>
				<div
					class="recipe-detail__overlay"
					@click="emit('close')"
				/>

				<div class="recipe-detail__drawer">
					<!-- Header -->
					<div class="recipe-detail__header">
						<div>
							<div class="recipe-detail__badges">
								<span
									class="recipe-detail__diet-badge"
									:class="`diet--${recipe.diet}`"
								>
									{{ DIET_LABELS[recipe.diet] }}
								</span>
								<span class="recipe-detail__origin-badge">
									{{ recipe.origin === 'claude' ? '🤖 Claude' : '✍️ Manuel' }}
								</span>
							</div>
							<h2 class="recipe-detail__title">{{ recipe.name }}</h2>
						</div>
						<button
							class="recipe-detail__close"
							@click="emit('close')"
						>
							✕
						</button>
					</div>

					<!-- Méta -->
					<div class="recipe-detail__meta">
						<div class="recipe-detail__meta-item">
							<span class="recipe-detail__meta-icon">🔥</span>
							<span>{{ recipe.calories }} kcal</span>
						</div>
						<div class="recipe-detail__meta-item">
							<span class="recipe-detail__meta-icon">⏱</span>
							<span>{{ recipe.prepTime }}min prép + {{ recipe.cookTime }}min cuisson</span>
						</div>
						<div class="recipe-detail__meta-item">
							<span class="recipe-detail__meta-icon">👥</span>
							<span>{{ recipe.servings }} portion(s)</span>
						</div>
						<div class="recipe-detail__meta-item">
							<span class="recipe-detail__meta-icon">📅</span>
							<span>
								Utilisé {{ recipe.usageCount }}x
								<template v-if="recipe.lastUsed">
									· Dernier : {{ formatDate(recipe.lastUsed) }}
								</template>
							</span>
						</div>
					</div>

					<!-- Note -->
					<div class="recipe-detail__rating">
						<button
							v-for="star in 5"
							:key="star"
							class="recipe-detail__star"
							:class="{ 'is-active': star <= recipe.rating }"
							@click="updateRating(star)"
						>
							{{ star <= recipe.rating ? '⭐' : '☆' }}
						</button>
					</div>

					<!-- Tags -->
					<div
						v-if="recipe.tags.length > 0"
						class="recipe-detail__tags"
					>
						<span
							v-for="tag in recipe.tags"
							:key="tag"
							class="recipe-detail__tag"
						>
							{{ tag }}
						</span>
					</div>

					<div class="recipe-detail__body">
						<!-- Ingrédients -->
						<div class="recipe-detail__section">
							<h3 class="recipe-detail__section-title">Ingrédients</h3>
							<ul class="recipe-detail__ingredients">
								<li
									v-for="(ing, i) in recipe.ingredients"
									:key="i"
									class="recipe-detail__ingredient"
								>
									<span class="recipe-detail__ingredient-qty">
										{{ ing.qty }} {{ ing.unit }}
									</span>
									<span>{{ ing.name }}</span>
								</li>
							</ul>
						</div>

						<!-- Étapes -->
						<div class="recipe-detail__section">
							<h3 class="recipe-detail__section-title">Préparation</h3>
							<ol class="recipe-detail__steps">
								<li
									v-for="(step, i) in recipe.steps"
									:key="i"
									class="recipe-detail__step"
								>
									{{ step }}
								</li>
							</ol>
						</div>

						<!-- Notes perso -->
						<div
							v-if="recipe.notes"
							class="recipe-detail__section"
						>
							<h3 class="recipe-detail__section-title">Notes</h3>
							<p class="recipe-detail__notes">{{ recipe.notes }}</p>
						</div>
					</div>

					<!-- Actions -->
					<div class="recipe-detail__actions">
						<button
							class="recipe-detail__action-btn recipe-detail__action-btn--primary"
							@click="emit('plan', recipe)"
						>
							📅 Planifier
						</button>
						<button
							class="recipe-detail__action-btn"
							@click="emit('edit', recipe)"
						>
							✏️ Modifier
						</button>
						<button
							class="recipe-detail__action-btn recipe-detail__action-btn--claude"
							:disabled="store.isLoading"
							@click="handleVariant"
						>
							🤖 Variante Claude
						</button>
						<button
							class="recipe-detail__action-btn recipe-detail__action-btn--danger"
							@click="handleDelete"
						>
							🗑️ Supprimer
						</button>
					</div>

					<!-- Variante générée -->
					<Transition name="fade">
						<div
							v-if="variantRecipe"
							class="recipe-detail__variant"
						>
							<div class="recipe-detail__variant-header">
								<h4>🤖 Variante suggérée</h4>
								<button
									class="recipe-detail__variant-close"
									@click="variantRecipe = null"
								>
									✕
								</button>
							</div>
							<p class="recipe-detail__variant-name">{{ variantRecipe.name }}</p>
							<p class="recipe-detail__variant-meta">
								🔥 {{ variantRecipe.calories }} kcal ·
								⏱ {{ variantRecipe.prepTime + variantRecipe.cookTime }} min
							</p>
							<button
								class="recipe-detail__variant-save"
								@click="saveVariant"
							>
								+ Sauvegarder dans la base
							</button>
						</div>
					</Transition>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import type { Recipe } from '@/stores/mealplanner'
import { DIET_LABELS, useMealPlannerStore } from '@/stores/mealplanner'
import { useClaude } from '@/composables/useClaude'

const props = defineProps<{
	recipe: Recipe | null
}>()

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'plan', recipe: Recipe): void
	(e: 'edit', recipe: Recipe): void
	(e: 'deleted', id: string): void
}>()

const store = useMealPlannerStore()
const claude = useClaude()
const variantRecipe = ref<Recipe | null>(null)

function updateRating(star: number) {
	if (!props.recipe) return
	store.updateRecipe(props.recipe.id, { rating: star as Recipe['rating'] })
}

async function handleVariant() {
	if (!props.recipe) return
	const variant = await claude.generateRecipeVariant({ originalRecipe: props.recipe })
	if (variant) variantRecipe.value = variant
}

function saveVariant() {
	if (!variantRecipe.value) return
	store.addRecipe({
		name: variantRecipe.value.name,
		slot: variantRecipe.value.slot,
		diet: variantRecipe.value.diet,
		tags: variantRecipe.value.tags,
		calories: variantRecipe.value.calories,
		prepTime: variantRecipe.value.prepTime,
		cookTime: variantRecipe.value.cookTime,
		servings: variantRecipe.value.servings,
		ingredients: variantRecipe.value.ingredients,
		steps: variantRecipe.value.steps,
		origin: 'claude',
		rating: variantRecipe.value.rating,
		notes: variantRecipe.value.notes,
	})
	variantRecipe.value = null
}

function handleDelete() {
	if (!props.recipe) return
	if (confirm(`Supprimer "${props.recipe.name}" ?`)) {
		store.deleteRecipe(props.recipe.id)
		emit('deleted', props.recipe.id)
		emit('close')
	}
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}
</script>

<style lang="scss" scoped>
.recipe-detail {
	position: fixed;
	inset: 0;
	z-index: 1000;
}

.recipe-detail__overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
}

.recipe-detail__drawer {
	position: absolute;
	inset-block: 0;
	inset-inline-end: 0;
	width: min(520px, 100vw);
	background: var(--white, #fff);
	display: flex;
	flex-direction: column;
	box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
	overflow-y: auto;
}

// ── Header ────────────────────────────────────

.recipe-detail__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding: 1.25rem 1.25rem 1rem;
	border-bottom: 1px solid var(--grey-200, #e8e8e8);
	position: sticky;
	top: 0;
	background: white;
	z-index: 1;
}

.recipe-detail__badges {
	display: flex;
	gap: 0.4rem;
	margin-bottom: 0.4rem;
}

.recipe-detail__diet-badge {
	font-size: 0.65rem;
	font-weight: 600;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;

	&.diet--vegan { background: #d1fae5; color: #065f46; }
	&.diet--fish  { background: #dbeafe; color: #1e40af; }
	&.diet--all   { background: #eec215; color: #92400e; }
}

.recipe-detail__origin-badge {
	font-size: 0.65rem;
	background: #f3e8ff;
	color: #6b21a8;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;
	font-weight: 600;
}

.recipe-detail__title {
	font-size: 1.25rem;
	font-weight: 700;
	color: var(--text, #333);
	margin: 0;
	line-height: 1.3;
}

.recipe-detail__close {
	background: none;
	border: none;
	font-size: 1rem;
	cursor: pointer;
	padding: 0.25rem 0.5rem;
	border-radius: 6px;
	color: var(--grey-500, #888);
	flex-shrink: 0;

	&:hover {
		background: var(--grey-100, #f5f5f5);
	}
}

// ── Méta ──────────────────────────────────────

.recipe-detail__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.75rem;
	padding: 0.75rem 1.25rem;
	background: var(--grey-50, #fafafa);
	border-bottom: 1px solid var(--grey-100, #f0f0f0);
}

.recipe-detail__meta-item {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	font-size: 0.8rem;
	color: var(--grey-600, #666);
}

// ── Note ──────────────────────────────────────

.recipe-detail__rating {
	display: flex;
	gap: 0.1rem;
	padding: 0.6rem 1.25rem 0;
}

.recipe-detail__star {
	background: none;
	border: none;
	font-size: 1.1rem;
	cursor: pointer;
	padding: 0.1rem;
	transition: transform 0.1s;

	&:hover {
		transform: scale(1.2);
	}
}

// ── Tags ──────────────────────────────────────

.recipe-detail__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem;
	padding: 0.5rem 1.25rem 0;
}

.recipe-detail__tag {
	font-size: 0.72rem;
	background: var(--grey-100, #f5f5f5);
	color: var(--grey-600, #666);
	padding: 0.15rem 0.5rem;
	border-radius: 4px;
}

// ── Body ──────────────────────────────────────

.recipe-detail__body {
	flex: 1;
	padding: 1rem 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

.recipe-detail__section-title {
	font-size: 0.875rem;
	font-weight: 700;
	color: var(--grey-500, #888);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin: 0 0 0.6rem;
}

.recipe-detail__ingredients {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.recipe-detail__ingredient {
	display: flex;
	gap: 0.5rem;
	font-size: 0.875rem;
	color: var(--text, #333);
}

.recipe-detail__ingredient-qty {
	font-weight: 600;
	color: var(--primary, #1973ff);
	min-width: 70px;
}

.recipe-detail__steps {
	padding-left: 1.25rem;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.recipe-detail__step {
	font-size: 0.875rem;
	color: var(--text, #333);
	line-height: 1.5;
}

.recipe-detail__notes {
	font-size: 0.875rem;
	color: var(--grey-600, #666);
	font-style: italic;
	margin: 0;
	padding: 0.75rem;
	background: var(--grey-50, #fafafa);
	border-radius: 8px;
}

// ── Actions ───────────────────────────────────

.recipe-detail__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	padding: 1rem 1.25rem;
	border-top: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	position: sticky;
	bottom: 0;
}

.recipe-detail__action-btn {
	padding: 0.45rem 0.9rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: var(--white, #fff);
	font-size: 0.85rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;

	&:hover:not(:disabled) {
		background: var(--grey-100, #f5f5f5);
	}

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover {
			background: var(--primary-dark, #1560d4) !important;
		}
	}

	&--claude {
		background: #f3e8ff;
		color: #6b21a8;
		border-color: #e9d5ff;

		&:hover:not(:disabled) {
			background: #e9d5ff !important;
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	&--danger {
		color: var(--danger, #e53e3e);

		&:hover {
			background: rgba(229, 62, 62, 0.08) !important;
			border-color: var(--danger, #e53e3e);
		}
	}
}

// ── Variante ──────────────────────────────────

.recipe-detail__variant {
	margin: 0 1.25rem 1rem;
	padding: 1rem;
	background: #f3e8ff;
	border: 1px solid #e9d5ff;
	border-radius: 12px;
}

.recipe-detail__variant-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.5rem;

	h4 {
		font-size: 0.85rem;
		font-weight: 700;
		color: #6b21a8;
		margin: 0;
	}
}

.recipe-detail__variant-close {
	background: none;
	border: none;
	color: #9333ea;
	cursor: pointer;
	font-size: 0.8rem;
}

.recipe-detail__variant-name {
	font-size: 0.9rem;
	font-weight: 600;
	color: var(--text, #333);
	margin: 0 0 0.25rem;
}

.recipe-detail__variant-meta {
	font-size: 0.78rem;
	color: var(--grey-500, #888);
	margin: 0 0 0.6rem;
}

.recipe-detail__variant-save {
	padding: 0.35rem 0.75rem;
	background: #6b21a8;
	color: white;
	border: none;
	border-radius: 6px;
	font-size: 0.8rem;
	cursor: pointer;
	transition: background 0.15s;

	&:hover {
		background: #581c87;
	}
}

// ── Transitions ───────────────────────────────

.panel-enter-active,
.panel-leave-active {
	transition: opacity 0.2s ease;

	.recipe-detail__drawer {
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}
}

.panel-enter-from,
.panel-leave-to {
	opacity: 0;

	.recipe-detail__drawer {
		transform: translateX(100%);
	}
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>