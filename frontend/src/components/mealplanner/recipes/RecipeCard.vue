<template>
	<div
		class="recipe-card"
		:class="{ 'is-cookable': isCookable }"
		@click="emit('click', recipe.id)"
	>
		<!-- Badge origine -->
		<div class="recipe-card__top">
			<span
				class="recipe-card__diet-badge"
				:class="`diet--${recipe.diet}`"
			>
				{{ DIET_LABELS[recipe.diet] }}
			</span>
			<span class="recipe-card__origin">
				{{ recipe.origin === 'claude' ? '🤖' : '✍️' }}
			</span>
		</div>

		<!-- Nom -->
		<h3 class="recipe-card__name">
			{{ recipe.name }}
		</h3>

		<!-- Tags -->
		<div
			v-if="recipe.tags.length > 0"
			class="recipe-card__tags"
		>
			<span
				v-for="tag in recipe.tags.slice(0, 3)"
				:key="tag"
				class="recipe-card__tag"
			>
				{{ tag }}
			</span>
		</div>

		<!-- Méta -->
		<div class="recipe-card__meta">
			<span>🔥 {{ recipe.calories }} kcal</span>
			<span>⏱ {{ recipe.prepTime + recipe.cookTime }} min</span>
			<span>👥 {{ recipe.servings }}p</span>
		</div>

		<!-- Note + utilisations -->
		<div class="recipe-card__footer">
			<span class="recipe-card__rating">
				{{ '⭐'.repeat(recipe.rating) }}{{ '☆'.repeat(5 - recipe.rating) }}
			</span>
			<span class="recipe-card__usage">
				{{ recipe.usageCount }}x
				<span v-if="recipe.lastUsed">
					· {{ formatDate(recipe.lastUsed) }}
				</span>
			</span>
		</div>

		<!-- Indicateur faisable avec inventaire -->
		<div
			v-if="isCookable"
			class="recipe-card__cookable"
			title="Faisable avec votre inventaire actuel"
		>
			🧊 Faisable
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { Recipe } from '@/stores/mealplanner'
import { DIET_LABELS, useMealPlannerStore } from '@/stores/mealplanner'

const props = defineProps<{
	recipe: Recipe
}>()

const emit = defineEmits<{
	(e: 'click', id: string): void
}>()

const store = useMealPlannerStore()

const isCookable = computed(() =>
	store.cookableRecipes.some(r => r.id === props.recipe.id),
)

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'short',
	})
}
</script>

<style lang="scss" scoped>
.recipe-card {
	position: relative;
	background: var(--white, #ffffff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	padding: 1rem;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;

	&:hover {
		border-color: var(--primary, #1973ff);
		box-shadow: 0 4px 16px rgba(25, 115, 255, 0.1);
		transform: translateY(-2px);
	}

	&.is-cookable {
		border-color: #10b981;
	}
}

.recipe-card__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.recipe-card__diet-badge {
	font-size: 0.65rem;
	font-weight: 600;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;

	&.diet--vegan { background: #d1fae5; color: #065f46; }
	&.diet--fish  { background: #dbeafe; color: #1e40af; }
	&.diet--all   { background: #eec215; color: #92400e; }
}

.recipe-card__origin {
	font-size: 0.85rem;
}

.recipe-card__name {
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--text, #333333);
	margin: 0;
	line-height: 1.3;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.recipe-card__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.25rem;
}

.recipe-card__tag {
	font-size: 0.68rem;
	background: var(--grey-100, #f5f5f5);
	color: var(--grey-600, #666666);
	padding: 0.1rem 0.4rem;
	border-radius: 4px;
}

.recipe-card__meta {
	display: flex;
	gap: 0.6rem;
	font-size: 0.75rem;
	color: var(--grey-500, #888888);
}

.recipe-card__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-block-start: auto;
}

.recipe-card__rating {
	font-size: 0.75rem;
}

.recipe-card__usage {
	font-size: 0.72rem;
	color: var(--grey-400, #bbbbbb);
}

.recipe-card__cookable {
	position: absolute;
	inset-block-start: 0.5rem;
	inset-inline-end: 0.5rem;
	font-size: 0.65rem;
	background: #d1fae5;
	color: #065f46;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;
	font-weight: 600;
}
</style>