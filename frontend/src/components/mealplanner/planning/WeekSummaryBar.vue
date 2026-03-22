<template>
	<div class="week-summary">
		<div
			v-for="day in store.DAYS"
			:key="day"
			class="week-summary__day"
			:class="`status--${store.dayStatus[day]}`"
		>
			<!-- Icône statut -->
			<span class="week-summary__status-icon">
				{{ statusIcon[store.dayStatus[day]] }}
			</span>

			<!-- Calories -->
			<span class="week-summary__calories">
				{{ store.dailyCalories[day] }} kcal
			</span>

			<!-- Barre de progression -->
			<div class="week-summary__bar-track">
				<div
					class="week-summary__bar-fill"
					:style="{ width: `${progressPercent(day)}%` }"
				/>
			</div>

			<!-- Max -->
			<span class="week-summary__max">
				/ {{ maxCalForDay(day) }}
			</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { useMealPlannerStore } from '@/stores/mealplanner'

const store = useMealPlannerStore()

const statusIcon = {
	ok: '✅',
	warning: '⚠️',
	error: '🔴',
}

function maxCalForDay(day: string): number {
	return store.constraints.days[day]?.maxCal
		?? store.constraints.global.maxCalPerDay
}

function progressPercent(day: string): number {
	const max = maxCalForDay(day)
	const current = store.dailyCalories[day]
	return Math.min(100, Math.round((current / max) * 100))
}
</script>

<style lang="scss" scoped>
.week-summary {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 0.5rem;
	padding: 0.75rem 0 0;
	border-block-start: 1px solid var(--grey-200, #e8e8e8);
	margin-block-start: 0.75rem;
}

.week-summary__day {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.2rem;
	font-size: 0.72rem;
	color: var(--grey-600, #666666);

	&.status--ok .week-summary__bar-fill {
		background: var(--success, #10b981);
	}

	&.status--warning .week-summary__bar-fill {
		background: var(--warning, #f59e0b);
	}

	&.status--error .week-summary__bar-fill {
		background: var(--danger, #e53e3e);
	}
}

.week-summary__status-icon {
	font-size: 0.85rem;
}

.week-summary__calories {
	font-weight: 600;
	color: var(--text, #333333);
}

.week-summary__bar-track {
	inline-size: 100%;
	block-size: 4px;
	background: var(--grey-200, #e8e8e8);
	border-radius: 999px;
	overflow: hidden;
}

.week-summary__bar-fill {
	block-size: 100%;
	border-radius: 999px;
	transition: width 0.3s ease;
}

.week-summary__max {
	color: var(--grey-400, #bbbbbb);
}
</style>