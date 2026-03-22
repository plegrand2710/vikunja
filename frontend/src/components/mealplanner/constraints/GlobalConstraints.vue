<template>
	<div class="global-constraints">
		<h3 class="global-constraints__title">
			Contraintes globales
		</h3>

		<div class="global-constraints__fields">
			<!-- Calories max par repas -->
			<div class="global-constraints__field">
				<div class="global-constraints__field-header">
					<label class="global-constraints__label">
						Calories max par repas
					</label>
					<span class="global-constraints__value">
						{{ store.constraints.global.maxCalPerMeal }} kcal
					</span>
				</div>
				<input
					type="range"
					min="200"
					max="1200"
					step="50"
					:value="store.constraints.global.maxCalPerMeal"
					class="global-constraints__slider"
					@input="updateMaxCalPerMeal"
				>
				<div class="global-constraints__slider-labels">
					<span>200</span>
					<span>700</span>
					<span>1200</span>
				</div>
			</div>

			<!-- Calories max par jour -->
			<div class="global-constraints__field">
				<div class="global-constraints__field-header">
					<label class="global-constraints__label">
						Calories max par jour
					</label>
					<span class="global-constraints__value">
						{{ store.constraints.global.maxCalPerDay }} kcal
					</span>
				</div>
				<input
					type="range"
					min="800"
					max="3500"
					step="100"
					:value="store.constraints.global.maxCalPerDay"
					class="global-constraints__slider"
					@input="updateMaxCalPerDay"
				>
				<div class="global-constraints__slider-labels">
					<span>800</span>
					<span>2000</span>
					<span>3500</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { useMealPlannerStore } from '@/stores/mealplanner'

const store = useMealPlannerStore()

function updateMaxCalPerMeal(e: Event) {
	const value = parseInt((e.target as HTMLInputElement).value)
	store.updateGlobalConstraints({ maxCalPerMeal: value })
}

function updateMaxCalPerDay(e: Event) {
	const value = parseInt((e.target as HTMLInputElement).value)
	store.updateGlobalConstraints({ maxCalPerDay: value })
}
</script>

<style lang="scss" scoped>
.global-constraints {
	background: var(--white, #ffffff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	padding: 1.25rem;
}

.global-constraints__title {
	font-size: 1rem;
	font-weight: 700;
	color: var(--text, #333333);
	margin: 0 0 1.25rem;
}

.global-constraints__fields {
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

.global-constraints__field {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.global-constraints__field-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.global-constraints__label {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--text, #333333);
}

.global-constraints__value {
	font-size: 0.875rem;
	font-weight: 700;
	color: var(--primary, #1973ff);
	background: var(--primary-light, #e8f0ff);
	padding: 0.15rem 0.5rem;
	border-radius: 999px;
}

.global-constraints__slider {
	inline-size: 100%;
	accent-color: var(--primary, #1973ff);
	cursor: pointer;
}

.global-constraints__slider-labels {
	display: flex;
	justify-content: space-between;
	font-size: 0.7rem;
	color: var(--grey-400, #bbbbbb);
}
</style>