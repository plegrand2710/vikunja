<template>
	<div class="calendar-view">
		<!-- Toolbar -->
		<CalendarToolbar
			:title="calendarTitle"
			@prev="handlePrev"
			@next="handleNext"
			@today="handleToday"
			@refresh="handleRefresh"
			@subscriptions="showSubscriptions = true"
		/>

		<!-- Légende des sources -->
		<CalendarLegend />

		<!-- Statut sync CalDAV — masqué si déjà configuré au build -->
		<SyncStatus v-if="!store.isCaldavConfigured" />

		<!-- Erreur de chargement -->
		<Transition name="fade">
			<div
				v-if="sources.error.value"
				class="calendar-view__error"
			>
				⚠️ {{ sources.error.value }}
			</div>
		</Transition>

		<!-- FullCalendar -->
		<div
			class="calendar-view__fc-wrapper"
			:class="{ 'is-loading': sources.isLoading.value }"
		>
			<FullCalendar
				ref="calendarRef"
				:options="calendarOptions"
			/>
		</div>

		<!-- Modales -->
		<EventModal />
		<EventDetail />
		<CalendarSubscriptions
			:is-open="showSubscriptions"
			@close="showSubscriptions = false"
			@refresh="calendarRef?.getApi().refetchEvents()"
		/>
	</div>
</template>

<script lang="ts" setup>
/**
 * CalendarView — vue principale du module calendrier
 *
 * Assemble FullCalendar avec les 5 sources de données :
 * - Événements locaux
 * - CalDAV (Google + Apple via Radicale)
 * - Tâches Vikunja
 * - Repas FridgeFlow
 */
import CalendarSubscriptions from '@/components/calendar/CalendarSubscriptions.vue'
const showSubscriptions = ref(false)
import { ref, computed, watch, onMounted } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core'
import { useCalendarStore } from '@/stores/calendar'
import { useCalendarSources } from '@/composables/useCalendarSources'

import CalendarToolbar from '@/components/calendar/CalendarToolbar.vue'
import CalendarLegend from '@/components/calendar/CalendarLegend.vue'
import SyncStatus from '@/components/calendar/SyncStatus.vue'
import EventModal from '@/components/calendar/EventModal.vue'
import EventDetail from '@/components/calendar/EventDetail.vue'

const store = useCalendarStore()
const sources = useCalendarSources()

// Référence vers l'instance FullCalendar
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

// Titre affiché dans la toolbar
const calendarTitle = ref('')

// ── Options FullCalendar ──────────────────────

const calendarOptions = computed<CalendarOptions>(() => ({
	plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
	locale: 'fr',

	// Vue initiale
	initialView: store.viewMode || 'timeGridWeek',

	// Désactiver la toolbar native de FullCalendar (on utilise la nôtre)
	headerToolbar: false,

	// Plage horaire visible
	slotMinTime: '06:00:00',
	slotMaxTime: '23:00:00',

	// Hauteur
	height: 'auto',
	contentHeight: 'auto',

	// Premier jour de la semaine : lundi
	firstDay: 1,

	// Sélection de créneaux (pour créer un événement)
	selectable: true,
	selectMirror: true,
	select: handleDateSelect,

	// Clic sur événement
	eventClick: handleEventClick,

	// Drag & drop (uniquement pour les événements locaux)
	editable: true,
	eventDrop: handleEventDrop,
	eventResizableFromStart: false,

	// Afficher le numéro de semaine
	weekNumbers: true,
	weekNumberFormat: { week: 'numeric' },

	// Événements
	events: (fetchInfo, successCallback) => {
		successCallback(sources.fullCalendarEvents.value)
	},

	// Callbacks de navigation (pour mettre à jour le titre)
	datesSet: (info) => {
		calendarTitle.value = info.view.title
	},

	// Style des événements
	eventDisplay: 'block',
	displayEventTime: true,
	eventTimeFormat: {
		hour: '2-digit',
		minute: '2-digit',
		meridiem: false,
	},

	// Taille des créneaux : 30 minutes
	slotDuration: '00:30:00',
	slotLabelInterval: '01:00:00',

	// Format des heures en colonne
	slotLabelFormat: {
		hour: '2-digit',
		minute: '2-digit',
		meridiem: false,
	},

	// Afficher "plus" si trop d'événements
	dayMaxEvents: true,

	// Texte "plus" en français
	moreLinkText: (n) => `+${n} autres`,

	// Boutons now indicator
	nowIndicator: true,
}))

// ── Watchers ──────────────────────────────────

// Changer de vue quand le store change
watch(() => store.viewMode, (mode) => {
	calendarRef.value?.getApi().changeView(mode)
})

// ── Handlers FullCalendar ─────────────────────

function handleDateSelect(info: DateSelectArg) {
	// Ouvrir le formulaire avec le créneau pré-rempli
	store.openEventModal({
		start: info.startStr,
		end: info.endStr,
	})
	// Désélectionner le créneau dans le calendrier
	calendarRef.value?.getApi().unselect()
}

function handleEventClick(info: EventClickArg) {
	const originalEvent = info.event.extendedProps.originalEvent
	if (originalEvent) {
		store.selectEvent(originalEvent)
	}
}

async function handleEventDrop(info: EventDropArg) {
	// Uniquement les événements locaux sont déplaçables
	const source = info.event.extendedProps.source
	if (source !== 'local') {
		info.revert()
		return
	}

	// Mettre à jour dans le store
	store.updateEvent(info.event.id, {
		start: info.event.startStr,
		end: info.event.endStr ?? info.event.startStr,
	})
}

// ── Navigation toolbar ────────────────────────

function handlePrev() {
	calendarRef.value?.getApi().prev()
}

function handleNext() {
	calendarRef.value?.getApi().next()
}

function handleToday() {
	calendarRef.value?.getApi().today()
}

async function handleRefresh() {
	await sources.loadAllSources()
	calendarRef.value?.getApi().refetchEvents()
}

// ── Chargement initial ────────────────────────

onMounted(async () => {
	// Initialiser le titre
	calendarTitle.value = calendarRef.value?.getApi().view.title ?? ''

	// Charger toutes les sources
	await sources.loadAllSources()
})
</script>

<style lang="scss">
// Styles globaux pour FullCalendar (non scoped car FullCalendar injecte son propre DOM)

.fc {
	// Variables FullCalendar overrides
	--fc-border-color: var(--grey-200, #e8e8e8);
	--fc-today-bg-color: rgba(25, 115, 255, 0.04);
	--fc-now-indicator-color: var(--primary, #1973ff);
	--fc-event-border-radius: 6px;
	--fc-small-font-size: 0.78rem;
	--fc-page-bg-color: transparent;
	--fc-neutral-bg-color: var(--grey-50, #fafafa);
	--fc-list-event-hover-bg-color: var(--grey-50, #fafafa);

	// Cellules
	.fc-daygrid-day,
	.fc-timegrid-slot {
		transition: background 0.1s;
	}

	// En-têtes des jours
	.fc-col-header-cell {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--grey-600, #666);
		padding: 0.5rem 0;
		background: var(--grey-50, #fafafa);
	}

	// Événements
	.fc-event {
		cursor: pointer;
		font-size: 0.78rem;
		font-weight: 500;
		border: none !important;
		padding: 2px 4px;

		&:hover {
			filter: brightness(1.1);
		}
	}

	// Numéros de semaine
	.fc-timegrid-axis,
	.fc-week-number {
		font-size: 0.72rem;
		color: var(--grey-400, #bbb);
	}

	// Indicateur "maintenant"
	.fc-timegrid-now-indicator-line {
		border-color: var(--primary, #1973ff);
		border-width: 2px;
	}

	.fc-timegrid-now-indicator-arrow {
		border-color: var(--primary, #1973ff);
	}

	// Sélection de créneau
	.fc-highlight {
		background: rgba(25, 115, 255, 0.1);
		border-radius: 6px;
	}

	// "More" link
	.fc-more-link {
		font-size: 0.72rem;
		color: var(--primary, #1973ff);
		font-weight: 600;
	}
}
</style>

<style lang="scss" scoped>
.calendar-view {
	display: flex;
	flex-direction: column;
	gap: 0;
	height: 100%;
}

.calendar-view__error {
	padding: 0.6rem 0.75rem;
	background: #fee2e2;
	color: #991b1b;
	border-radius: 8px;
	font-size: 0.875rem;
	margin-bottom: 0.75rem;
}

.calendar-view__fc-wrapper {
	flex: 1;
	min-height: 0;
	transition: opacity 0.2s ease;

	&.is-loading {
		opacity: 0.6;
		pointer-events: none;
	}
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>