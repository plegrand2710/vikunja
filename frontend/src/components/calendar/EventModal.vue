<template>
	<Teleport to="body">
		<Transition name="modal">
			<div
				v-if="store.isEventModalOpen"
				class="event-modal"
			>
				<div
					class="event-modal__overlay"
					@click="store.closeEventModal()"
				/>

				<div class="event-modal__panel">
					<!-- Header -->
					<div class="event-modal__header">
						<h3>{{ isEditing ? 'Modifier l\'événement' : 'Nouvel événement' }}</h3>
						<button
							class="event-modal__close"
							@click="store.closeEventModal()"
						>
							✕
						</button>
					</div>

					<!-- Formulaire -->
					<div class="event-modal__body">

						<!-- Titre -->
						<div class="event-modal__field">
							<label>Titre *</label>
							<input
								v-model="form.title"
								type="text"
								placeholder="Réunion, RDV médecin..."
								class="event-modal__input"
								autofocus
								@keydown.enter="handleSave"
							/>
						</div>

						<!-- Toute la journée -->
						<div class="event-modal__field event-modal__field--row">
							<label class="event-modal__checkbox-label">
								<input
									v-model="form.allDay"
									type="checkbox"
									class="event-modal__checkbox"
								/>
								Toute la journée
							</label>
						</div>

						<!-- Dates -->
						<div class="event-modal__field">
							<label>Début</label>
							<div class="event-modal__datetime">
								<input
									v-model="form.startDate"
									type="date"
									class="event-modal__input"
								/>
								<input
									v-if="!form.allDay"
									v-model="form.startTime"
									type="time"
									class="event-modal__input event-modal__input--time"
								/>
							</div>
						</div>

						<div class="event-modal__field">
							<label>Fin</label>
							<div class="event-modal__datetime">
								<input
									v-model="form.endDate"
									type="date"
									class="event-modal__input"
								/>
								<input
									v-if="!form.allDay"
									v-model="form.endTime"
									type="time"
									class="event-modal__input event-modal__input--time"
								/>
							</div>
						</div>

						<!-- Répétition -->
						<div class="event-modal__field">
							<label>Répétition</label>
							<select
								v-model="form.recurrence"
								class="event-modal__select"
							>
								<option value="none">Aucune</option>
								<option value="daily">Chaque jour</option>
								<option value="weekly">Chaque semaine</option>
								<option value="monthly">Chaque mois</option>
							</select>
						</div>

						<!-- Couleur -->
						<div class="event-modal__field">
							<label>Couleur</label>
							<div class="event-modal__colors">
								<button
									v-for="color in COLORS"
									:key="color"
									class="event-modal__color-btn"
									:class="{ 'is-active': form.color === color }"
									:style="{ background: color }"
									@click="form.color = color"
								/>
							</div>
						</div>

						<!-- Description -->
						<div class="event-modal__field">
							<label>Description</label>
							<textarea
								v-model="form.description"
								rows="2"
								placeholder="Notes, lieu, lien visio..."
								class="event-modal__textarea"
							/>
						</div>

					</div>

					<!-- Footer -->
					<div class="event-modal__footer">
						<button
							v-if="isEditing"
							class="event-modal__btn event-modal__btn--danger"
							@click="handleDelete"
						>
							Supprimer
						</button>
						<div class="event-modal__footer-right">
							<button
								class="event-modal__btn"
								@click="store.closeEventModal()"
							>
								Annuler
							</button>
							<button
								class="event-modal__btn event-modal__btn--primary"
								:disabled="!form.title.trim()"
								@click="handleSave"
							>
								{{ isEditing ? 'Enregistrer' : 'Créer' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useCalDAV } from '@/composables/useCalDAV'
import type { RecurrenceType } from '@/stores/calendar'

const store = useCalendarStore()
const caldav = useCalDAV()

// Couleurs disponibles
const COLORS = [
	'#7c3aed', // violet (local défaut)
	'#1973ff', // bleu
	'#ea4335', // rouge
	'#10b981', // vert
	'#f59e0b', // orange
	'#ec4899', // rose
	'#06b6d4', // cyan
	'#555555', // gris
]

// ── Helpers datetime ──────────────────────────

function toDateInput(iso: string): string {
	return iso.substring(0, 10)
}

function toTimeInput(iso: string): string {
	return iso.substring(11, 16)
}

function buildISO(date: string, time: string, allDay: boolean): string {
	if (allDay) return `${date}T00:00:00`
	return `${date}T${time}:00`
}

function defaultEnd(startDate: string, startTime: string): { date: string; time: string } {
	const start = new Date(`${startDate}T${startTime}:00`)
	start.setHours(start.getHours() + 1)
	return {
		date: start.toISOString().substring(0, 10),
		time: start.toISOString().substring(11, 16),
	}
}

// ── État du formulaire ────────────────────────

const now = new Date()
const defaultDate = now.toISOString().substring(0, 10)
const defaultTime = `${String(now.getHours()).padStart(2, '0')}:00`

const form = reactive({
	title: '',
	allDay: false,
	startDate: defaultDate,
	startTime: defaultTime,
	endDate: defaultDate,
	endTime: `${String(now.getHours() + 1).padStart(2, '0')}:00`,
	recurrence: 'none' as RecurrenceType,
	color: COLORS[0],
	description: '',
})

const isEditing = computed(() => store.selectedEvent?.source === 'local')

// Pré-remplir depuis le créneau cliqué ou l'événement sélectionné
watch(() => store.isEventModalOpen, (open) => {
	if (!open) return

	if (store.selectedEvent && store.selectedEvent.source === 'local') {
		// Mode édition
		const e = store.selectedEvent
		form.title = e.title
		form.allDay = e.allDay
		form.startDate = toDateInput(e.start)
		form.startTime = toTimeInput(e.start)
		form.endDate = toDateInput(e.end)
		form.endTime = toTimeInput(e.end)
		form.recurrence = e.recurrence
		form.color = e.color ?? COLORS[0]
		form.description = e.description ?? ''
	} else if (store.pendingSlot) {
		// Clic sur un créneau
		form.title = ''
		form.allDay = false
		form.startDate = toDateInput(store.pendingSlot.start)
		form.startTime = toTimeInput(store.pendingSlot.start)
		form.endDate = toDateInput(store.pendingSlot.end)
		form.endTime = toTimeInput(store.pendingSlot.end)
		form.recurrence = 'none'
		form.color = COLORS[0]
		form.description = ''
	} else {
		// Nouveau depuis le bouton
		form.title = ''
		form.allDay = false
		form.startDate = defaultDate
		form.startTime = defaultTime
		const end = defaultEnd(defaultDate, defaultTime)
		form.endDate = end.date
		form.endTime = end.time
		form.recurrence = 'none'
		form.color = COLORS[0]
		form.description = ''
	}
})

// Auto-ajuster la date de fin si début change
watch(() => form.startDate, (newDate) => {
	if (newDate > form.endDate) {
		form.endDate = newDate
	}
})

// ── Actions ───────────────────────────────────

async function handleSave() {
	if (!form.title.trim()) return

	const start = buildISO(form.startDate, form.startTime, form.allDay)
	const end = buildISO(form.endDate, form.endTime, form.allDay)

	if (isEditing.value && store.selectedEvent) {
		// Mise à jour
		store.updateEvent(store.selectedEvent.id, {
			title: form.title,
			start,
			end,
			allDay: form.allDay,
			recurrence: form.recurrence,
			color: form.color,
			description: form.description,
		})

		// Sync CalDAV si configuré
		if (store.isCaldavConfigured) {
			const updated = store.localEvents.find(e => e.id === store.selectedEvent!.id)
			if (updated) await caldav.updateCalDAVEvent(updated)
		}
	} else {
		// Création
		const newEvent = store.createEvent({
			title: form.title,
			start,
			end,
			allDay: form.allDay,
			recurrence: form.recurrence,
			color: form.color,
			description: form.description,
		})

		// Sync CalDAV si configuré
		if (store.isCaldavConfigured) {
			await caldav.createCalDAVEvent(newEvent)
		}
	}

	store.closeEventModal()
	store.selectEvent(null)
}

async function handleDelete() {
	if (!store.selectedEvent) return

	// Supprimer sur CalDAV si possible
	if (store.isCaldavConfigured && store.selectedEvent.caldavUrl) {
		await caldav.deleteCalDAVEvent(store.selectedEvent)
	}

	store.deleteEvent(store.selectedEvent.id)
	store.closeEventModal()
	store.selectEvent(null)
}
</script>

<style lang="scss" scoped>
.event-modal {
	position: fixed;
	inset: 0;
	z-index: 1500;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1rem;
}

.event-modal__overlay {
	position: absolute;
	inset: 0;
	background: rgba(0,0,0,0.4);
}

.event-modal__panel {
	position: relative;
	background: white;
	border-radius: 16px;
	width: min(480px, 100%);
	box-shadow: 0 16px 48px rgba(0,0,0,0.2);
	overflow: hidden;
}

.event-modal__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1.25rem 1.5rem 1rem;
	border-bottom: 1px solid var(--grey-200, #e8e8e8);

	h3 {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
		color: var(--text, #333);
	}
}

.event-modal__close {
	background: none;
	border: none;
	font-size: 1rem;
	cursor: pointer;
	padding: 0.25rem 0.5rem;
	border-radius: 6px;
	color: var(--grey-500, #888);

	&:hover { background: var(--grey-100, #f5f5f5); }
}

.event-modal__body {
	padding: 1.25rem 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
	max-height: 60vh;
	overflow-y: auto;
}

.event-modal__field {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;

	label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--grey-600, #666);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	&--row {
		flex-direction: row;
		align-items: center;
	}
}

.event-modal__checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.875rem !important;
	font-weight: 500 !important;
	color: var(--text, #333) !important;
	text-transform: none !important;
	letter-spacing: 0 !important;
	cursor: pointer;
}

.event-modal__checkbox {
	width: 1rem;
	height: 1rem;
	cursor: pointer;
	accent-color: var(--primary, #1973ff);
}

.event-modal__datetime {
	display: flex;
	gap: 0.5rem;
}

.event-modal__input {
	width: 100%;
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	transition: border-color 0.15s;
	box-sizing: border-box;

	&:focus { border-color: var(--primary, #1973ff); }

	&--time { width: 110px; flex-shrink: 0; }
}

.event-modal__select {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	background: white;
}

.event-modal__textarea {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	resize: vertical;
	font-family: inherit;
	transition: border-color 0.15s;

	&:focus { border-color: var(--primary, #1973ff); }
}

.event-modal__colors {
	display: flex;
	gap: 0.5rem;
	flex-wrap: wrap;
}

.event-modal__color-btn {
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 50%;
	border: 2px solid transparent;
	cursor: pointer;
	transition: transform 0.1s, border-color 0.1s;

	&:hover { transform: scale(1.15); }

	&.is-active {
		border-color: var(--text, #333);
		transform: scale(1.15);
	}
}

.event-modal__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1rem 1.5rem;
	border-top: 1px solid var(--grey-200, #e8e8e8);
}

.event-modal__footer-right {
	display: flex;
	gap: 0.5rem;
	margin-left: auto;
}

.event-modal__btn {
	padding: 0.45rem 0.9rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;

	&:hover:not(:disabled) { background: var(--grey-100, #f5f5f5); }
	&:disabled { opacity: 0.5; cursor: not-allowed; }

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover:not(:disabled) { background: var(--primary-dark, #1560d4); }
	}

	&--danger {
		color: var(--danger, #e53e3e);

		&:hover { background: rgba(229,62,62,0.08); border-color: var(--danger, #e53e3e); }
	}
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }

.event-modal__panel {
  background: var(--site-background, #1e2028) !important;
  color: var(--text, #e0e0e0) !important;
}

.event-modal__header h3 {
  color: var(--text, #e0e0e0) !important;
}

.event-modal__input,
.event-modal__select,
.event-modal__textarea {
  background: var(--input-background, #2a2d38) !important;
  color: var(--text, #e0e0e0) !important;
  border-color: var(--input-border, #3a3d4a) !important;
}

.event-modal__btn:not(.event-modal__btn--primary):not(.event-modal__btn--danger) {
  background: var(--input-background, #2a2d38) !important;
  color: var(--text, #e0e0e0) !important;
  border-color: var(--input-border, #3a3d4a) !important;
}
</style>