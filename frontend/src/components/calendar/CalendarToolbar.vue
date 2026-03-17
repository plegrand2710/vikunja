<template>
	<div class="cal-toolbar">
		<!-- Navigation -->
		<div class="cal-toolbar__nav">
			<button
				class="cal-toolbar__btn"
				@click="emit('prev')"
			>
				‹
			</button>
			<button
				class="cal-toolbar__btn cal-toolbar__btn--today"
				@click="emit('today')"
			>
				Aujourd'hui
			</button>
			<button
				class="cal-toolbar__btn"
				@click="emit('next')"
			>
				›
			</button>
			<span class="cal-toolbar__title">{{ title }}</span>
		</div>

		<!-- Vue switch -->
		<div class="cal-toolbar__views">
			<button
				class="cal-toolbar__view-btn"
				:class="{ 'is-active': store.viewMode === 'timeGridWeek' }"
				@click="store.setViewMode('timeGridWeek')"
			>
				Semaine
			</button>
			<button
				class="cal-toolbar__view-btn"
				:class="{ 'is-active': store.viewMode === 'dayGridMonth' }"
				@click="store.setViewMode('dayGridMonth')"
			>
				Mois
			</button>
		</div>

		<!-- Actions -->
		<div class="cal-toolbar__actions">
			<button
				class="cal-toolbar__btn cal-toolbar__btn--primary"
				@click="store.openEventModal()"
			>
				+ Événement
			</button>
			<button
				class="cal-toolbar__btn"
				:disabled="sources.isLoading.value"
				@click="emit('refresh')"
			>
				{{ sources.isLoading.value ? '⟳ Sync...' : '⟳ Sync' }}
			</button>
			<button
				class="cal-toolbar__btn"
				@click="emit('subscriptions')"
				>
				+ Abonnements
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { useCalendarStore } from '@/stores/calendar'
import { useCalendarSources } from '@/composables/useCalendarSources'

defineProps<{
	title: string
}>()

const emit = defineEmits<{
	(e: 'prev'): void
	(e: 'next'): void
	(e: 'today'): void
	(e: 'refresh'): void
}>()

const store = useCalendarStore()
const sources = useCalendarSources()
</script>

<style lang="scss" scoped>
.cal-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
	padding: 0 0 1rem;
	border-bottom: 1px solid var(--grey-200, #e8e8e8);
	margin-bottom: 1rem;
}

.cal-toolbar__nav {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.cal-toolbar__title {
	font-size: 1rem;
	font-weight: 700;
	color: var(--text, #333);
	margin-left: 0.5rem;
}

.cal-toolbar__views {
	display: flex;
	gap: 0.25rem;
	background: var(--grey-100, #f5f5f5);
	padding: 0.25rem;
	border-radius: 10px;
}

.cal-toolbar__view-btn {
	padding: 0.35rem 0.75rem;
	border-radius: 8px;
	border: none;
	background: transparent;
	cursor: pointer;
	font-size: 0.85rem;
	font-weight: 500;
	color: var(--grey-600, #666);
	transition: background 0.15s, color 0.15s;

	&:hover { background: var(--grey-200, #e8e8e8); }

	&.is-active {
		background: white;
		color: var(--text, #333);
		box-shadow: 0 1px 4px rgba(0,0,0,0.08);
	}
}

.cal-toolbar__actions {
	display: flex;
	gap: 0.5rem;
}

.cal-toolbar__btn {
	padding: 0.4rem 0.8rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.85rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;

	&:hover:not(:disabled) { background: var(--grey-100, #f5f5f5); }
	&:disabled { opacity: 0.5; cursor: not-allowed; }

	&--today {
		font-weight: 600;
	}

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover { background: var(--primary-dark, #1560d4); }
	}
}

// Correction thème dark
.cal-toolbar__title {
  color: var(--text, #fff) !important;
}

.cal-toolbar__btn:not(.cal-toolbar__btn--primary),
.cal-toolbar__view-btn:not(.is-active) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: var(--text, #fff) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.cal-toolbar__view-btn {
  &.is-active {
    background: var(--input-background, #2a2d38) !important;
    color: var(--text, #e0e0e0) !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
}

.cal-toolbar__views {
  background: var(--grey-800, #1a1d24) !important;
}
</style>