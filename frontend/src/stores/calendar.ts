/**
 * Store Pinia — Module Calendrier
 *
 * Gère :
 * - Les événements locaux (créés dans l'app)
 * - La configuration des sources (Google, Apple, Vikunja, FridgeFlow)
 * - Les filtres et préférences d'affichage
 * - La persistance via localStorage
 */
import { generateUUID } from '@/utils/uuid'
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type EventSource = 'local' | 'vikunja' | 'google' | 'apple' | 'fridgeflow' | 'partner'

export type { ICalendarSubscription as CalendarSubscription } from '@/modelTypes/ICalendarSubscription'
import type { ICalendarSubscription } from '@/modelTypes/ICalendarSubscription'

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'

export interface CalendarEvent {
	id: string
	title: string
	start: string              // ISO datetime "2026-03-16T10:00:00"
	end: string                // ISO datetime "2026-03-16T11:00:00"
	allDay: boolean
	source: EventSource
	color?: string
	description?: string
	recurrence: RecurrenceType
	// Liens vers d'autres modules
	taskId?: string            // si lié à une tâche Vikunja
	caldavUrl?: string         // URL CalDAV pour edit/delete sur Radicale
	projectId?: number         // projet Vikunja associé
	attendees?: string[]       // participants
}

export interface CalendarSource {
	id: EventSource
	name: string
	color: string
	enabled: boolean
	lastSync?: string          // ISO datetime
	error?: string
}

export interface CalDAVConfig {
	url: string                // ex: http://82.67.177.75:9090/radicale/pauline/
	username: string
	password: string           // stocké en mémoire uniquement, jamais persisté
}

// ─────────────────────────────────────────────
// COULEURS PAR DÉFAUT
// ─────────────────────────────────────────────

export const SOURCE_COLORS: Record<EventSource, string> = {
	local:      '#7c3aed',    // violet
	vikunja:    '#1973ff',    // bleu
	google:     '#ea4335',    // rouge Google
	apple:      '#555555',    // gris foncé
	fridgeflow: '#f59e0b',    // orange
	partner:    '#10b981',    // vert
}

export const SOURCE_LABELS: Record<EventSource, string> = {
	local:      'Événements personnels',
	vikunja:    'Tâches Vikunja',
	google:     'Google Calendar',
	apple:      'Apple Calendar',
	fridgeflow: 'Repas FridgeFlow',
	partner:    'Programme conjoint',
}

// Heures d'affichage des repas dans le calendrier (configurable)
export const DEFAULT_MEAL_TIMES = {
	breakfast: { hour: 7, minute: 30, duration: 30 },
	lunch:     { hour: 12, minute: 30, duration: 60 },
	dinner:    { hour: 19, minute: 30, duration: 60 },
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function generateId(): string {
	return generateUUID()
}

function loadFromStorage<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key)
		return raw ? JSON.parse(raw) as T : fallback
	} catch {
		return fallback
	}
}

function saveToStorage(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch (e) {
		console.error('[calendar store] Erreur localStorage:', e)
	}
}

const STORAGE_KEYS = {
	events:    'calendar_events',
	sources:   'calendar_sources',
	mealTimes: 'calendar_meal_times',
	viewMode:  'calendar_view_mode',
} as const

// ─────────────────────────────────────────────
// LE STORE
// ─────────────────────────────────────────────

export const useCalendarStore = defineStore('calendar', () => {

	// ── STATE ──────────────────────────────────

	/** Événements locaux (créés dans l'app, stockés dans localStorage) */
	const localEvents = ref<CalendarEvent[]>(
		loadFromStorage<CalendarEvent[]>(STORAGE_KEYS.events, []) ?? [],
	)

	/** Configuration des sources */
	const sources = ref<CalendarSource[]>(
		loadFromStorage(STORAGE_KEYS.sources, [
			{ id: 'local',      name: SOURCE_LABELS.local,      color: SOURCE_COLORS.local,      enabled: true },
			{ id: 'vikunja',    name: SOURCE_LABELS.vikunja,    color: SOURCE_COLORS.vikunja,    enabled: true },
			{ id: 'google',     name: SOURCE_LABELS.google,     color: SOURCE_COLORS.google,     enabled: true },
			{ id: 'apple',      name: SOURCE_LABELS.apple,      color: SOURCE_COLORS.apple,      enabled: true },
			{ id: 'fridgeflow', name: SOURCE_LABELS.fridgeflow, color: SOURCE_COLORS.fridgeflow, enabled: true },
			{ id: 'partner',    name: SOURCE_LABELS.partner,    color: SOURCE_COLORS.partner,    enabled: true },
		] as CalendarSource[]),
	)

	/** Configuration CalDAV (Radicale) — jamais persistée pour la sécurité */
	const caldavConfig = ref<CalDAVConfig>({
		url: import.meta.env.VITE_CALDAV_URL ?? '',
		username: import.meta.env.VITE_CALDAV_USERNAME ?? '',
		password: import.meta.env.VITE_CALDAV_PASSWORD ?? '',
	})

	/** Shared subscriptions fetched from the backend API */
	const sharedSubscriptions = ref<ICalendarSubscription[]>([])

	/** IDs of subscriptions disabled by the current user (stored in frontendSettings) */
	const disabledSubscriptionIds = ref<number[]>([])

	const isSubscriptionModalOpen = ref(false)
	const editingSubscription = ref<ICalendarSubscription | null>(null)

	/** Heures d'affichage des repas */
	const mealTimes = ref(
		loadFromStorage(STORAGE_KEYS.mealTimes, DEFAULT_MEAL_TIMES),
	)

	/** Mode d'affichage courant */
	const storedViewMode = loadFromStorage<string>(STORAGE_KEYS.viewMode, 'timeGridWeek')
	const viewMode = ref<'timeGridWeek' | 'dayGridMonth'>(
		storedViewMode === 'timeGridWeek' || storedViewMode === 'dayGridMonth'
			? storedViewMode
			: 'timeGridWeek',
	)
	/** Date courante affichée dans le calendrier */
	const currentDate = ref(new Date().toISOString())

	/** Événement sélectionné (pour le panneau de détail) */
	const selectedEvent = ref<CalendarEvent | null>(null)

	/** Panneau de création ouvert */
	const isEventModalOpen = ref(false)

	/** Créneau pré-rempli lors d'un clic sur le calendrier */
	const pendingSlot = ref<{ start: string; end: string } | null>(null)

	/** État de chargement global */
	const isLoading = ref(false)

	/** Événements CalDAV chargés depuis Radicale (Google + Apple + locaux) */
	const caldavEvents = ref<CalendarEvent[]>([])

	const subscriptionEvents = ref<CalendarEvent[]>([])

	/** Événements Vikunja chargés depuis l'API REST */
	const vikunjaEvents = ref<CalendarEvent[]>([])

	// ── GETTERS ────────────────────────────────

	/** Sources actives uniquement */
	const activeSources = computed(() =>
		sources.value.filter(s => s.enabled),
	)

	/** IDs des sources actives */
	const activeSourceIds = computed(() =>
		new Set(activeSources.value.map(s => s.id)),
	)

	/** Tous les événements filtrés par sources actives */
	const allEvents = computed(() => {
		const all = [
			...localEvents.value,
			...caldavEvents.value,
			...subscriptionEvents.value,
			...vikunjaEvents.value,
		]
		return all.filter(e =>
			activeSourceIds.value.has(e.source) ||
            e.source.toString().startsWith('sub_'),
		)
	})

	/** Config CalDAV est-elle renseignée */
	const isCaldavConfigured = computed(() =>
		caldavConfig.value.url !== '' &&
		caldavConfig.value.username !== '' &&
		caldavConfig.value.password !== '',
	)

	/** Source par ID */
	function getSource(id: EventSource) {
		return sources.value.find(s => s.id === id)
	}

	// ── ACTIONS — Événements locaux ────────────

	function createEvent(event: Omit<CalendarEvent, 'id' | 'source' | 'recurrence'> & { recurrence?: RecurrenceType }): CalendarEvent {
		const newEvent: CalendarEvent = {
			...event,
			id: generateId(),
			source: 'local',
			recurrence: event.recurrence ?? 'none',
			color: event.color ?? SOURCE_COLORS.local,
		}
		localEvents.value.push(newEvent)
		saveToStorage(STORAGE_KEYS.events, localEvents.value)
		return newEvent
	}

	function updateEvent(id: string, updates: Partial<CalendarEvent>): void {
		const index = localEvents.value.findIndex(e => e.id === id)
		if (index !== -1) {
			localEvents.value[index] = { ...localEvents.value[index], ...updates }
			saveToStorage(STORAGE_KEYS.events, localEvents.value)
		}
	}

	function deleteEvent(id: string): void {
		localEvents.value = localEvents.value.filter(e => e.id !== id)
		saveToStorage(STORAGE_KEYS.events, localEvents.value)
	}

	// ── ACTIONS — Événements externes ──────────

	function setCaldavEvents(events: CalendarEvent[]): void {
		caldavEvents.value = events
	}

	function setSubscriptionEvents(events: CalendarEvent[]): void {
		subscriptionEvents.value = events
	}

	function setVikunjaEvents(events: CalendarEvent[]): void {
		vikunjaEvents.value = events
	}

	function updateSourceSyncStatus(id: EventSource, status: { lastSync?: string; error?: string }): void {
		const source = sources.value.find(s => s.id === id)
		if (source) {
			if (status.lastSync) source.lastSync = status.lastSync
			if (status.error !== undefined) source.error = status.error
		}
	}

	// ── ACTIONS — Sources ──────────────────────

	function toggleSource(id: EventSource): void {
		const source = sources.value.find(s => s.id === id)
		if (source) {
			source.enabled = !source.enabled
			saveToStorage(STORAGE_KEYS.sources, sources.value)
		}
	}

	function updateSourceColor(id: EventSource, color: string): void {
		const source = sources.value.find(s => s.id === id)
		if (source) {
			source.color = color
			saveToStorage(STORAGE_KEYS.sources, sources.value)
		}
	}

	// ── ACTIONS — Config CalDAV ─────────────────

	function setCalDAVConfig(config: CalDAVConfig): void {
		// Jamais persisté dans localStorage — sécurité
		caldavConfig.value = config
	}

	// ── ACTIONS — UI ───────────────────────────

	function setViewMode(mode: typeof viewMode.value): void {
		viewMode.value = mode
		saveToStorage(STORAGE_KEYS.viewMode, mode)
	}

	function openEventModal(slot?: { start: string; end: string }): void {
		pendingSlot.value = slot ?? null
		isEventModalOpen.value = true
	}

	function closeEventModal(): void {
		isEventModalOpen.value = false
		pendingSlot.value = null
	}

	function selectEvent(event: CalendarEvent | null): void {
		selectedEvent.value = event
	}

	function setLoading(loading: boolean): void {
		isLoading.value = loading
	}

	function updateMealTimes(times: typeof mealTimes.value): void {
		mealTimes.value = times
		saveToStorage(STORAGE_KEYS.mealTimes, times)
	}

	function setSharedSubscriptions(subs: ICalendarSubscription[]): void {
		sharedSubscriptions.value = subs
	}

	function setDisabledSubscriptions(ids: number[]): void {
		disabledSubscriptionIds.value = ids
	}

	function toggleSubscription(id: number): void {
		const idx = disabledSubscriptionIds.value.indexOf(id)
		if (idx === -1) {
			disabledSubscriptionIds.value = [...disabledSubscriptionIds.value, id]
		} else {
			disabledSubscriptionIds.value = disabledSubscriptionIds.value.filter(i => i !== id)
		}
	}

	function isSubscriptionEnabled(id: number): boolean {
		return !disabledSubscriptionIds.value.includes(id)
	}

	function openSubscriptionModal(sub?: ICalendarSubscription): void {
		editingSubscription.value = sub ?? null
		isSubscriptionModalOpen.value = true
	}

	function closeSubscriptionModal(): void {
		isSubscriptionModalOpen.value = false
		editingSubscription.value = null
	}

	// ── RETURN ─────────────────────────────────

	return {
		// State
		localEvents,
		sources,
		caldavConfig,
		mealTimes,
		viewMode,
		currentDate,
		selectedEvent,
		isEventModalOpen,
		pendingSlot,
		isLoading,
		caldavEvents,
		subscriptionEvents,
		setSubscriptionEvents,
		vikunjaEvents,

		// Getters
		activeSources,
		activeSourceIds,
		allEvents,
		isCaldavConfigured,
		getSource,

		// Actions — événements locaux
		createEvent,
		updateEvent,
		deleteEvent,

		// Actions — événements externes
		setCaldavEvents,
		setVikunjaEvents,
		updateSourceSyncStatus,

		// Actions — sources
		toggleSource,
		updateSourceColor,

		// Actions — CalDAV
		setCalDAVConfig,

		// Actions — UI
		setViewMode,
		openEventModal,
		closeEventModal,
		selectEvent,
		setLoading,
		updateMealTimes,

		// Constantes
		SOURCE_COLORS,
		SOURCE_LABELS,

		// Shared subscriptions state
		sharedSubscriptions,
		disabledSubscriptionIds,
		isSubscriptionModalOpen,
		editingSubscription,

		// Shared subscriptions actions
		setSharedSubscriptions,
		setDisabledSubscriptions,
		toggleSubscription,
		isSubscriptionEnabled,
		openSubscriptionModal,
		closeSubscriptionModal,
	}
})