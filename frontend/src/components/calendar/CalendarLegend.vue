<template>
	<div class="cal-legend">
		<button
			v-for="source in store.sources"
			:key="source.id"
			class="cal-legend__item"
			:class="{ 'is-disabled': !source.enabled }"
			@click="handleToggleSource(source.id)"
		>
			<span
				class="cal-legend__dot"
				:style="{ background: source.enabled ? source.color : '#ccc' }"
			/>
			<span class="cal-legend__label">{{ source.name }}</span>
			<span
				v-if="source.lastSync"
				class="cal-legend__sync"
			>
				{{ formatSyncTime(source.lastSync) }}
			</span>
			<span
				v-if="source.error"
				class="cal-legend__error"
				:title="source.error"
			>
				⚠️
			</span>
		</button>
	</div>
</template>

<script lang="ts" setup>
import { useCalendarStore } from '@/stores/calendar'
import { useVikunjaSettings } from '@/composables/useVikunjaSettings'

const store = useCalendarStore()
const vikunjaSettings = useVikunjaSettings()

function handleToggleSource(id: Parameters<typeof store.toggleSource>[0]) {
  store.toggleSource(id)
  vikunjaSettings.saveSources()
}

function formatSyncTime(isoDate: string): string {
	const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000 / 60)
	if (diff < 1) return 'à l\'instant'
	if (diff < 60) return `il y a ${diff}min`
	return `il y a ${Math.floor(diff / 60)}h`
}
</script>

<style lang="scss" scoped>
.cal-legend {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	padding: 0.75rem 0;
	border-bottom: 1px solid var(--grey-100, #f0f0f0);
	margin-bottom: 0.75rem;
}

.cal-legend__item {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.25rem 0.6rem;
	border-radius: 999px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	cursor: pointer;
	font-size: 0.78rem;
	transition: opacity 0.15s, background 0.15s;

	&:hover { background: var(--grey-50, #fafafa); }

	&.is-disabled {
		opacity: 0.45;
	}
}

.cal-legend__dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex-shrink: 0;
	transition: background 0.15s;
}

.cal-legend__label {
	color: var(--text, #333);
	font-weight: 500;
}

.cal-legend__sync {
	color: var(--grey-400, #bbb);
	font-size: 0.7rem;
}

.cal-legend__error {
	font-size: 0.75rem;
}

.cal-legend__item {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.cal-legend__label {
  color: var(--text, #fff) !important;
}
</style>