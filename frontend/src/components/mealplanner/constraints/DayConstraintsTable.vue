<template>
	<div class="day-constraints">
		<h3 class="day-constraints__title">
			Contraintes par jour
		</h3>

		<div class="day-constraints__table">
			<!-- En-tête -->
			<div class="day-constraints__header">
				<span>Jour</span>
				<span>Régime</span>
				<span>Calories max</span>
				<span>Ingrédient à écouler</span>
			</div>

			<!-- Ligne par jour -->
			<div
				v-for="day in store.DAYS"
				:key="day"
				class="day-constraints__row"
				:class="`diet-row--${store.constraints.days[day]?.diet}`"
			>
				<!-- Nom du jour -->
				<span class="day-constraints__day-name">
					{{ store.DAYS_FR[day] }}
				</span>

				<!-- Sélecteur de régime -->
				<div class="day-constraints__diet-select">
					<button
						v-for="diet in DIETS"
						:key="diet.value"
						class="day-constraints__diet-btn"
						:class="{ 'is-active': store.constraints.days[day]?.diet === diet.value }"
						@click="store.updateDayConstraint(day, { diet: diet.value })"
					>
						{{ diet.label }}
					</button>
				</div>

				<!-- Calories max custom -->
				<div class="day-constraints__cal-input">
					<input
						type="number"
						:placeholder="`${store.constraints.global.maxCalPerDay} (défaut)`"
						:value="store.constraints.days[day]?.maxCal ?? ''"
						min="500"
						max="4000"
						step="100"
						class="day-constraints__input"
						@change="updateMaxCal(day, $event)"
					>
					<button
						v-if="store.constraints.days[day]?.maxCal !== null"
						class="day-constraints__clear-btn"
						title="Réinitialiser"
						@click="store.updateDayConstraint(day, { maxCal: null })"
					>
						✕
					</button>
				</div>

				<!-- Ingrédient à écouler -->
				<div class="day-constraints__ingredient-input">
					<input
						type="text"
						placeholder="ex: épinards"
						:value="store.constraints.days[day]?.mustUseIngredient ?? ''"
						class="day-constraints__input"
						@change="updateMustUse(day, $event)"
					>
					<button
						v-if="store.constraints.days[day]?.mustUseIngredient"
						class="day-constraints__clear-btn"
						title="Supprimer"
						@click="store.updateDayConstraint(day, { mustUseIngredient: null })"
					>
						✕
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { DietType } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'

const store = useMealPlannerStore()

const DIETS: { value: DietType; label: string }[] = [
	{ value: 'vegan', label: '🥦' },
	{ value: 'fish', label: '🐟' },
	{ value: 'all', label: '🍽️' },
]

function updateMaxCal(day: string, e: Event) {
	const val = (e.target as HTMLInputElement).value
	store.updateDayConstraint(day, {
		maxCal: val === '' ? null : parseInt(val),
	})
}

function updateMustUse(day: string, e: Event) {
	const val = (e.target as HTMLInputElement).value.trim()
	store.updateDayConstraint(day, {
		mustUseIngredient: val === '' ? null : val,
	})
}
</script>

<style lang="scss" scoped>
.day-constraints {
	background: var(--white, #ffffff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	padding: 1.25rem;
}

.day-constraints__title {
	font-size: 1rem;
	font-weight: 700;
	color: var(--text, #333333);
	margin: 0 0 1.25rem;
}

.day-constraints__table {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
}

.day-constraints__header {
	display: grid;
	grid-template-columns: 100px 120px 1fr 1fr;
	gap: 0.75rem;
	padding: 0 0.75rem 0.5rem;
	border-block-end: 1px solid var(--grey-200, #e8e8e8);
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--grey-500, #888888);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.day-constraints__row {
	display: grid;
	grid-template-columns: 100px 120px 1fr 1fr;
	gap: 0.75rem;
	align-items: center;
	padding: 0.6rem 0.75rem;
	border-radius: 8px;
	transition: background 0.15s;

	&:hover {
		background: var(--grey-50, #fafafa);
	}

	&.diet-row--vegan {
		border-inline-start: 3px solid #10b981;
	}

	&.diet-row--fish {
		border-inline-start: 3px solid #3b82f6;
	}

	&.diet-row--all {
		border-inline-start: 3px solid #f59e0b;
	}
}

.day-constraints__day-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--text, #333333);
}

// ── Sélecteur régime ──────────────────────────

.day-constraints__diet-select {
	display: flex;
	gap: 0.25rem;
}

.day-constraints__diet-btn {
	padding: 0.25rem 0.5rem;
	border-radius: 6px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: transparent;
	cursor: pointer;
	font-size: 0.9rem;
	transition: background 0.15s, border-color 0.15s;

	&:hover {
		background: var(--grey-100, #f5f5f5);
	}

	&.is-active {
		background: var(--primary, #1973ff);
		border-color: var(--primary, #1973ff);
	}
}

// ── Inputs ────────────────────────────────────

.day-constraints__cal-input,
.day-constraints__ingredient-input {
	display: flex;
	align-items: center;
	gap: 0.35rem;
}

.day-constraints__input {
	flex: 1;
	padding: 0.35rem 0.6rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 6px;
	font-size: 0.8rem;
	background: var(--grey-50, #fafafa);
	outline: none;
	min-inline-size: 0;
	transition: border-color 0.15s;

	&:focus {
		border-color: var(--primary, #1973ff);
		background: white;
	}

	&::placeholder {
		color: var(--grey-400, #bbbbbb);
		font-size: 0.75rem;
	}
}

.day-constraints__clear-btn {
	background: none;
	border: none;
	color: var(--grey-400, #bbbbbb);
	cursor: pointer;
	padding: 0.2rem;
	font-size: 0.75rem;
	border-radius: 4px;
	flex-shrink: 0;
	transition: color 0.15s;

	&:hover {
		color: var(--danger, #e53e3e);
	}
}

// ── Responsive ────────────────────────────────

@media screen and (width <= 768px) {
	.day-constraints__header,
	.day-constraints__row {
		grid-template-columns: 80px 100px 1fr;
	}

	.day-constraints__ingredient-input {
		display: none;
	}
}
</style>