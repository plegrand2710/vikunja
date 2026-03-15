<template>
	<div
		class="meal-cell"
		:class="{
			'is-empty': !meal,
			'is-locked': meal?.locked,
			'is-violation': isViolation,
		}"
		@click="handleClick"
	>
		<!-- Cellule vide -->
		<div
			v-if="!meal"
			class="meal-cell__empty"
		>
			<span class="meal-cell__add-icon">+</span>
		</div>

		<!-- Cellule avec un repas -->
		<div
			v-else
			class="meal-cell__content"
		>
			<!-- Badge régime -->
			<span
				class="meal-cell__diet-badge"
				:class="`diet--${meal.diet}`"
			>
				{{ DIET_LABELS[meal.diet] }}
			</span>

			<!-- Nom du repas -->
			<p class="meal-cell__name">{{ meal.name }}</p>

			<!-- Calories -->
			<p class="meal-cell__calories">
				🔥 {{ meal.calories }} kcal
			</p>

			<!-- Actions -->
			<div
				class="meal-cell__actions"
				@click.stop
			>
				<!-- Verrouiller -->
				<button
					class="meal-cell__action-btn"
					:title="meal.locked ? 'Déverrouiller' : 'Verrouiller'"
					@click="emit('toggle-lock', day, slot)"
				>
					{{ meal.locked ? '🔒' : '🔓' }}
				</button>

				<!-- Supprimer -->
				<button
					class="meal-cell__action-btn meal-cell__action-btn--danger"
					title="Supprimer"
					@click="emit('remove', day, slot)"
				>
					✕
				</button>
			</div>
		</div>

		<!-- Indicateur de violation -->
		<div
			v-if="isViolation"
			class="meal-cell__violation"
			title="Ce repas ne respecte pas les contraintes du jour"
		>
			⚠️
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * CONCEPTS VUE UTILISÉS ICI :
 *
 * defineProps() → déclare les données que le composant PARENT passe à ce composant
 * defineEmits() → déclare les événements que ce composant envoie au PARENT
 *
 * Exemple du flux :
 *   WeekGrid (parent) → passe `meal` via props → MealCell l'affiche
 *   MealCell → émet 'remove' → WeekGrid écoute et supprime le repas
 */

import { computed } from 'vue'
import type { PlannedMeal, MealSlot, DietType } from '@/stores/mealplanner'
import { DIET_LABELS } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'

// ── PROPS ─────────────────────────────────────
// Les données que le parent nous passe

const props = defineProps<{
	day: string
	slot: MealSlot
	meal: PlannedMeal | null
}>()

// ── EMITS ─────────────────────────────────────
// Les événements qu'on envoie au parent

const emit = defineEmits<{
	(e: 'click', day: string, slot: MealSlot): void
	(e: 'remove', day: string, slot: MealSlot): void
	(e: 'toggle-lock', day: string, slot: MealSlot): void
}>()

const store = useMealPlannerStore()

// Vérifie si ce repas viole les contraintes du jour
const isViolation = computed(() => {
	if (!props.meal) return false
	const dayConstraint = store.constraints.days[props.day]
	if (!dayConstraint) return false

	const mealDiet: DietType = props.meal.diet

	if (dayConstraint.diet === 'vegan' && mealDiet !== 'vegan') return true
	if (dayConstraint.diet === 'fish' && mealDiet === 'all') return true

	const maxCal = store.constraints.global.maxCalPerMeal
	if (props.meal.calories > maxCal) return true

	return false
})

function handleClick() {
	emit('click', props.day, props.slot)
}
</script>

<style lang="scss" scoped>
.meal-cell {
	position: relative;
	border-radius: 10px;
	border: 2px solid var(--grey-200, #e8e8e8);
	background: var(--white, #fff);
	min-height: 110px;
	cursor: pointer;
	transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	overflow: hidden;

	&:hover {
		border-color: var(--primary, #1973ff);
		box-shadow: 0 2px 12px rgba(25, 115, 255, 0.12);
		transform: translateY(-1px);
	}

	&.is-empty {
		border-style: dashed;
		background: var(--grey-50, #fafafa);

		&:hover {
			background: var(--primary-light, #e8f0ff);
			border-color: var(--primary, #1973ff);
		}
	}

	&.is-locked {
		border-color: var(--grey-400, #bbb);

		&::after {
			content: '';
			position: absolute;
			inset: 0;
			background: rgba(0, 0, 0, 0.03);
			pointer-events: none;
		}
	}

	&.is-violation {
		border-color: var(--danger, #e53e3e);
		background: rgba(229, 62, 62, 0.04);
	}
}

// ── CELLULE VIDE ─────────────────────────────

.meal-cell__empty {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	min-height: 110px;
}

.meal-cell__add-icon {
	font-size: 1.8rem;
	color: var(--grey-400, #bbb);
	line-height: 1;
	transition: color 0.15s ease, transform 0.15s ease;

	.meal-cell:hover & {
		color: var(--primary, #1973ff);
		transform: scale(1.2);
	}
}

// ── CELLULE AVEC REPAS ────────────────────────

.meal-cell__content {
	padding: 0.6rem 0.7rem 0.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	height: 100%;
}

.meal-cell__diet-badge {
	display: inline-flex;
	align-items: center;
	font-size: 0.65rem;
	font-weight: 600;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;
	width: fit-content;

	&.diet--vegan {
		background: #d1fae5;
		color: #065f46;
	}

	&.diet--fish {
		background: #dbeafe;
		color: #1e40af;
	}

	&.diet--all {
		background: #eec215;
		color: #92400e;
	}
}

.meal-cell__name {
	font-size: 0.82rem;
	font-weight: 600;
	color: var(--text, #333);
	margin: 0;
	line-height: 1.3;
	// Tronque si trop long
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.meal-cell__calories {
	font-size: 0.72rem;
	color: var(--grey-500, #888);
	margin: 0;
}

// ── ACTIONS ───────────────────────────────────

.meal-cell__actions {
	display: flex;
	gap: 0.25rem;
	margin-top: auto;
	padding-top: 0.25rem;
	opacity: 0;
	transition: opacity 0.15s ease;

	.meal-cell:hover & {
		opacity: 1;
	}
}

.meal-cell__action-btn {
	background: var(--grey-100, #f5f5f5);
	border: none;
	border-radius: 6px;
	padding: 0.2rem 0.4rem;
	font-size: 0.75rem;
	cursor: pointer;
	transition: background 0.15s ease;

	&:hover {
		background: var(--grey-200, #e8e8e8);
	}

	&--danger:hover {
		background: rgba(229, 62, 62, 0.15);
		color: var(--danger, #e53e3e);
	}
}

// ── VIOLATION ─────────────────────────────────

.meal-cell__violation {
	position: absolute;
	top: 0.3rem;
	right: 0.3rem;
	font-size: 0.8rem;
	line-height: 1;
}
</style>