<template>
	<Teleport to="body">
		<Transition name="panel">
			<div
				v-if="store.selectedEvent && !store.isEventModalOpen"
				class="event-detail"
			>
				<div
					class="event-detail__overlay"
					@click="store.selectEvent(null)"
				/>

				<div class="event-detail__drawer">
					<!-- Bande couleur en haut -->
					<div
						class="event-detail__color-bar"
						:style="{ background: event?.color ?? sourceColor }"
					/>

					<!-- Header -->
					<div class="event-detail__header">
						<div>
							<span class="event-detail__source-badge">
								{{ sourceLabel }}
							</span>
							<h2 class="event-detail__title">{{ event?.title }}</h2>
						</div>
						<button
							class="event-detail__close"
							@click="store.selectEvent(null)"
						>
							✕
						</button>
					</div>

					<!-- Infos -->
					<div class="event-detail__infos">
						<!-- Date/heure -->
						<div class="event-detail__info-row">
							<span class="event-detail__info-icon">📅</span>
							<span>{{ formatDateRange }}</span>
						</div>

						<!-- Récurrence -->
						<div
							v-if="event?.recurrence && event.recurrence !== 'none'"
							class="event-detail__info-row"
						>
							<span class="event-detail__info-icon">🔁</span>
							<span>{{ recurrenceLabel }}</span>
						</div>

						<!-- Description -->
						<div
							v-if="event?.description"
							class="event-detail__info-row"
						>
							<span class="event-detail__info-icon">📝</span>
							<span>{{ event.description }}</span>
						</div>

						<!-- Lien vers tâche Vikunja -->
						<div
							v-if="event?.taskId"
							class="event-detail__info-row"
						>
							<span class="event-detail__info-icon">☑️</span>
							<span>Tâche Vikunja #{{ event.taskId }}</span>
						</div>
					</div>

					<!-- Actions -->
					<div class="event-detail__actions">
						<!-- Événement local → modifiable -->
						<template v-if="event?.source === 'local'">
							<button
								class="event-detail__btn event-detail__btn--primary"
								@click="handleEdit"
							>
								✏️ Modifier
							</button>
							<button
								class="event-detail__btn event-detail__btn--danger"
								@click="handleDelete"
							>
								🗑️ Supprimer
							</button>
						</template>

						<!-- FridgeFlow → lien vers le module repas -->
						<template v-else-if="event?.source === 'fridgeflow'">
							<button
								class="event-detail__btn event-detail__btn--primary"
								@click="goToMealPlanner"
							>
								🍽️ Voir dans FridgeFlow
							</button>
						</template>

						<!-- Vikunja → lien vers la tâche -->
						<template v-else-if="event?.source === 'vikunja' && event.taskId">
							<button
								class="event-detail__btn event-detail__btn--primary"
								@click="goToTask"
							>
								☑️ Voir la tâche
							</button>
						</template>

						<!-- Google / Apple → lecture seule -->
						<template v-else>
							<p class="event-detail__readonly">
								Événement en lecture seule ({{ sourceLabel }})
							</p>
						</template>

						<button
							class="event-detail__btn"
							@click="store.selectEvent(null)"
						>
							Fermer
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '@/stores/calendar'
import { useCalDAV } from '@/composables/useCalDAV'
import { SOURCE_COLORS, SOURCE_LABELS } from '@/stores/calendar'

const store = useCalendarStore()
const caldav = useCalDAV()
const router = useRouter()

const event = computed(() => store.selectedEvent)

const sourceColor = computed(() =>
	event.value ? SOURCE_COLORS[event.value.source] : '#7c3aed'
)

const sourceLabel = computed(() =>
	event.value ? SOURCE_LABELS[event.value.source] : ''
)

const recurrenceLabels: Record<string, string> = {
	daily:   'Répète chaque jour',
	weekly:  'Répète chaque semaine',
	monthly: 'Répète chaque mois',
}

const recurrenceLabel = computed(() =>
	event.value?.recurrence ? recurrenceLabels[event.value.recurrence] ?? '' : ''
)

const formatDateRange = computed(() => {
	if (!event.value) return ''

	const start = new Date(event.value.start)
	const end = new Date(event.value.end)

	const dateOpts: Intl.DateTimeFormatOptions = {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}

	if (event.value.allDay) {
		const startStr = start.toLocaleDateString('fr-FR', dateOpts)
		if (event.value.start === event.value.end) return startStr
		return `${startStr} → ${end.toLocaleDateString('fr-FR', dateOpts)}`
	}

	const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
	const startDate = start.toLocaleDateString('fr-FR', dateOpts)
	const startTime = start.toLocaleTimeString('fr-FR', timeOpts)
	const endTime = end.toLocaleTimeString('fr-FR', timeOpts)

	return `${startDate} · ${startTime} → ${endTime}`
})

// ── Actions ───────────────────────────────────

function handleEdit() {
	store.openEventModal()
}

async function handleDelete() {
	if (!event.value) return
	if (!confirm(`Supprimer "${event.value.title}" ?`)) return

	if (store.isCaldavConfigured && event.value.caldavUrl) {
		await caldav.deleteCalDAVEvent(event.value)
	}

	store.deleteEvent(event.value.id)
	store.selectEvent(null)
}

function goToMealPlanner() {
	store.selectEvent(null)
	router.push({ name: 'meal-planner' })
}

function goToTask() {
	if (!event.value?.taskId) return
	store.selectEvent(null)
	router.push({ name: 'task.detail', params: { id: event.value.taskId } })
}
</script>

<style lang="scss" scoped>
.event-detail {
	position: fixed;
	inset: 0;
	z-index: 1000;
}

.event-detail__overlay {
	position: absolute;
	inset: 0;
	background: rgba(0,0,0,0.3);
}

.event-detail__drawer {
	position: absolute;
	inset-block: 0;
	inset-inline-end: 0;
	width: min(420px, 100vw);
	background: white;
	box-shadow: -4px 0 24px rgba(0,0,0,0.15);
	display: flex;
	flex-direction: column;
	overflow-y: auto;
}

.event-detail__color-bar {
	height: 6px;
	flex-shrink: 0;
}

.event-detail__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding: 1.25rem 1.25rem 0.75rem;
	border-bottom: 1px solid var(--grey-100, #f0f0f0);
}

.event-detail__source-badge {
	font-size: 0.7rem;
	font-weight: 600;
	color: var(--grey-500, #888);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	display: block;
	margin-bottom: 0.25rem;
}

.event-detail__title {
	font-size: 1.2rem;
	font-weight: 700;
	color: var(--text, #333);
	margin: 0;
	line-height: 1.3;
}

.event-detail__close {
	background: none;
	border: none;
	font-size: 1rem;
	cursor: pointer;
	padding: 0.25rem 0.5rem;
	border-radius: 6px;
	color: var(--grey-500, #888);
	flex-shrink: 0;

	&:hover { background: var(--grey-100, #f5f5f5); }
}

.event-detail__infos {
	flex: 1;
	padding: 1rem 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.event-detail__info-row {
	display: flex;
	align-items: flex-start;
	gap: 0.75rem;
	font-size: 0.875rem;
	color: var(--text, #333);
	line-height: 1.5;
}

.event-detail__info-icon {
	font-size: 1rem;
	flex-shrink: 0;
	margin-top: 0.1rem;
}

.event-detail__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	padding: 1rem 1.25rem;
	border-top: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	position: sticky;
	bottom: 0;
}

.event-detail__readonly {
	font-size: 0.8rem;
	color: var(--grey-500, #888);
	font-style: italic;
	margin: 0;
	flex: 1;
}

.event-detail__btn {
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

	&--danger {
		color: var(--danger, #e53e3e);

		&:hover { background: rgba(229,62,62,0.08); border-color: var(--danger, #e53e3e); }
	}
}

.panel-enter-active,
.panel-leave-active {
	transition: opacity 0.2s ease;

	.event-detail__drawer {
		transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
	}
}

.panel-enter-from,
.panel-leave-to {
	opacity: 0;

	.event-detail__drawer { transform: translateX(100%); }
}
.event-detail__drawer {
  background: var(--site-background, #1e2028) !important;
}

.event-detail__title,
.event-detail__info-row {
  color: var(--text, #e0e0e0) !important;
}

.event-detail__actions {
  background: var(--site-background, #1e2028) !important;
  border-color: var(--input-border, #3a3d4a) !important;
}

.event-detail__btn:not(.event-detail__btn--primary):not(.event-detail__btn--danger) {
  background: var(--input-background, #2a2d38) !important;
  color: var(--text, #e0e0e0) !important;
  border-color: var(--input-border, #3a3d4a) !important;
}
</style>