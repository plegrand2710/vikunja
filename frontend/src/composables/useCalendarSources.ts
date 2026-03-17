/**
 * Composable useCalendarSources
 * Agrège les 5 sources de données du calendrier :
 * 1. Événements locaux (depuis le store)
 * 2. Événements CalDAV : Google + Apple + Personnel (depuis Radicale)
 * 3. Tâches Vikunja (depuis l'API REST)
 * 4. Repas FridgeFlow (depuis le store mealplanner)
 * 5. Programme conjoint (tâches Vikunja assignées au conjoint)
 *
 * Retourne des événements au format FullCalendar EventInput
 */

import { useSubscriptions } from '@/composables/useSubscriptions'
import { ref, computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useCalDAV } from '@/composables/useCalDAV'
import { useAuthStore } from '@/stores/auth'
import { useMealPlannerStore } from '@/stores/mealplanner'
import type { CalendarEvent } from '@/stores/calendar'

// ─────────────────────────────────────────────
// TYPES FULLCALENDAR
// ─────────────────────────────────────────────

export interface FCEvent {
	id: string
	title: string
	start: string
	end: string
	allDay: boolean
	backgroundColor: string
	borderColor: string
	textColor: string
	extendedProps: {
		source: string
		description?: string
		recurrence?: string
		taskId?: string
		caldavUrl?: string
		originalEvent?: CalendarEvent
	}
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function toFCEvent(event: CalendarEvent, color: string): FCEvent {
	return {
		id: event.id,
		title: event.title,
		start: event.start,
		end: event.end,
		allDay: event.allDay,
		backgroundColor: color,
		borderColor: color,
		textColor: '#ffffff',
		extendedProps: {
			source: event.source,
			description: event.description,
			recurrence: event.recurrence,
			taskId: event.taskId,
			caldavUrl: event.caldavUrl,
			originalEvent: event,
		},
	}
}

/**
 * Formate une date ISO + heure en string ISO datetime
 * ex: ('2026-03-16', 7, 30) → '2026-03-16T07:30:00'
 */
function buildDateTime(dateStr: string, hour: number, minute: number): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${dateStr}T${pad(hour)}:${pad(minute)}:00`
}

/**
 * Ajoute des minutes à une heure
 */
function addMinutes(isoDatetime: string, minutes: number): string {
	const date = new Date(isoDatetime)
	date.setMinutes(date.getMinutes() + minutes)
	return date.toISOString().replace('Z', '')
}

/**
 * Retourne le lundi de la semaine d'une date ISO
 */
function getMondayOf(dateStr: string): Date {
	const date = new Date(dateStr)
	const day = date.getDay()
	const diff = day === 0 ? -6 : 1 - day
	date.setDate(date.getDate() + diff)
	return date
}

/**
 * Retourne le nom du jour en anglais (pour le store mealplanner)
 */
function getDayKey(date: Date): string {
	return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}

// ─────────────────────────────────────────────
// LE COMPOSABLE
// ─────────────────────────────────────────────

export function useCalendarSources() {
	const calendarStore = useCalendarStore()
	const caldav = useCalDAV()
	const authStore = useAuthStore()
	const mealStore = useMealPlannerStore()

	const isLoading = ref(false)
	const error = ref<string | null>(null)

	// ── Source 1 : Événements locaux ──────────
	// Déjà dans le store — rien à charger

	// ── Source 2 : CalDAV (Radicale) ──────────

	async function loadCalDAVEvents(): Promise<void> {
		if (!calendarStore.isCaldavConfigured) return
		await caldav.fetchAllEvents()
	}

	// ── Source 3 : Tâches Vikunja ─────────────

	async function loadVikunjaEvents(): Promise<void> {
		if (!calendarStore.activeSourceIds.has('vikunja')) return

		try {
			// @ts-expect-error — window.API_URL défini par Vikunja dans index.html
			const apiUrl = window.API_URL ?? '/api/v1'
			// @ts-expect-error — token dans le store auth
			const token = authStore.token ?? localStorage.getItem('token')

			if (!token) return

			// Récupérer toutes les tâches avec une date d'échéance
			const response = await fetch(
				`${apiUrl}/tasks?filter_by=due_date&filter_comparator=not_null&per_page=100`,
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			)

			if (!response.ok) return

			const tasks = await response.json()
			if (!Array.isArray(tasks)) return

			const vikunjaColor = calendarStore.getSource('vikunja')?.color ?? '#1973ff'

			const events: CalendarEvent[] = tasks
				.filter((task: { due_date?: string }) => task.due_date)
				.map((task: {
					id: number
					title: string
					due_date: string
					start_date?: string
					description?: string
					project_id?: number
				}) => ({
					id: `vikunja-${task.id}`,
					title: task.title,
					start: task.start_date ?? task.due_date,
					end: task.due_date,
					allDay: true,
					source: 'vikunja' as const,
					color: vikunjaColor,
					description: task.description,
					recurrence: 'none' as const,
					taskId: String(task.id),
					projectId: task.project_id,
				}))

			calendarStore.setVikunjaEvents(events)
			calendarStore.updateSourceSyncStatus('vikunja', {
				lastSync: new Date().toISOString(),
				error: undefined,
			})
		} catch (e) {
			console.error('[useCalendarSources] Erreur chargement tâches Vikunja:', e)
			calendarStore.updateSourceSyncStatus('vikunja', {
				error: 'Impossible de charger les tâches',
			})
		}
	}

	// ── Source 4 : Repas FridgeFlow ───────────

	function buildFridgeFlowEvents(): FCEvent[] {
		if (!calendarStore.activeSourceIds.has('fridgeflow')) return []

		const color = calendarStore.getSource('fridgeflow')?.color ?? '#f59e0b'
		const events: FCEvent[] = []
		const { mealTimes } = calendarStore
		const { weekPlan, recipes, DAYS } = mealStore

		// Obtenir le lundi de la semaine courante du planning
		const monday = getMondayOf(weekPlan.weekStart)

		DAYS.forEach((dayKey, index) => {
			const dayDate = new Date(monday)
			dayDate.setDate(monday.getDate() + index)
			const dateStr = dayDate.toISOString().split('T')[0]

			const dayPlan = weekPlan.days[dayKey]
			if (!dayPlan) return

			// Petit-déjeuner
			if (dayPlan.breakfast) {
				const recipe = recipes.find(r => r.id === dayPlan.breakfast!.recipeId)
				const start = buildDateTime(dateStr, mealTimes.breakfast.hour, mealTimes.breakfast.minute)
				const end = addMinutes(start, mealTimes.breakfast.duration)
				events.push({
					id: `fridgeflow-breakfast-${dateStr}`,
					title: `🌅 ${dayPlan.breakfast.name}`,
					start,
					end,
					allDay: false,
					backgroundColor: color,
					borderColor: color,
					textColor: '#ffffff',
					extendedProps: {
						source: 'fridgeflow',
						description: recipe
							? `${recipe.calories} kcal · ${recipe.prepTime + recipe.cookTime} min`
							: undefined,
						originalEvent: {
							id: `fridgeflow-breakfast-${dateStr}`,
							title: dayPlan.breakfast.name,
							start,
							end,
							allDay: false,
							source: 'fridgeflow',
							recurrence: 'none',
						},
					},
				})
			}

			// Déjeuner
			if (dayPlan.lunch) {
				const recipe = recipes.find(r => r.id === dayPlan.lunch!.recipeId)
				const start = buildDateTime(dateStr, mealTimes.lunch.hour, mealTimes.lunch.minute)
				const end = addMinutes(start, mealTimes.lunch.duration)
				events.push({
					id: `fridgeflow-lunch-${dateStr}`,
					title: `🍽️ ${dayPlan.lunch.name}`,
					start,
					end,
					allDay: false,
					backgroundColor: color,
					borderColor: color,
					textColor: '#ffffff',
					extendedProps: {
						source: 'fridgeflow',
						description: recipe
							? `${recipe.calories} kcal · ${recipe.prepTime + recipe.cookTime} min`
							: undefined,
						originalEvent: {
							id: `fridgeflow-lunch-${dateStr}`,
							title: dayPlan.lunch.name,
							start,
							end,
							allDay: false,
							source: 'fridgeflow',
							recurrence: 'none',
						},
					},
				})
			}

			// Dîner
			if (dayPlan.dinner) {
				const recipe = recipes.find(r => r.id === dayPlan.dinner!.recipeId)
				const start = buildDateTime(dateStr, mealTimes.dinner.hour, mealTimes.dinner.minute)
				const end = addMinutes(start, mealTimes.dinner.duration)
				events.push({
					id: `fridgeflow-dinner-${dateStr}`,
					title: `🌙 ${dayPlan.dinner.name}`,
					start,
					end,
					allDay: false,
					backgroundColor: color,
					borderColor: color,
					textColor: '#ffffff',
					extendedProps: {
						source: 'fridgeflow',
						description: recipe
							? `${recipe.calories} kcal · ${recipe.prepTime + recipe.cookTime} min`
							: undefined,
						originalEvent: {
							id: `fridgeflow-dinner-${dateStr}`,
							title: dayPlan.dinner.name,
							start,
							end,
							allDay: false,
							source: 'fridgeflow',
							recurrence: 'none',
						},
					},
				})
			}
		})

		return events
	}

	// ── Chargement global ─────────────────────

	async function loadAllSources(): Promise<void> {
        isLoading.value = true
        error.value = null

        try {
            const subsComposable = useSubscriptions()
            const [, , subscriptionEvents] = await Promise.all([
            loadCalDAVEvents(),
            loadVikunjaEvents(),
            subsComposable.fetchAllSubscriptions(),
            ])

            // Stocker les événements des abonnements dans le store
            // (ajoute subscriptionEvents au store calendar)
            calendarStore.setSubscriptionEvents(subscriptionEvents)
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Erreur de chargement'
        } finally {
            isLoading.value = false
        }
    }

	// ── Événements formatés pour FullCalendar ──

	const fullCalendarEvents = computed((): FCEvent[] => {
		const events: FCEvent[] = []

		// Source 1 : événements locaux
		for (const event of calendarStore.localEvents) {
			if (!calendarStore.activeSourceIds.has('local')) continue
			const color = calendarStore.getSource('local')?.color ?? '#7c3aed'
			events.push(toFCEvent(event, color))
		}

		// Source 2 : CalDAV (Google + Apple + Personnel via Radicale)
		for (const event of calendarStore.caldavEvents) {
			if (!calendarStore.activeSourceIds.has(event.source as 'google' | 'apple')) continue
			const color = calendarStore.getSource(event.source as 'google' | 'apple')?.color
				?? '#555555'
			events.push(toFCEvent(event, color))
		}

		// Source 3 : Tâches Vikunja
		for (const event of calendarStore.vikunjaEvents) {
			if (!calendarStore.activeSourceIds.has('vikunja')) continue
			const color = calendarStore.getSource('vikunja')?.color ?? '#1973ff'
			events.push(toFCEvent(event, color))
		}

		// Source 4 : Repas FridgeFlow
		events.push(...buildFridgeFlowEvents())

        // Source 5 : Abonnements externes (ICS, CalDAV tiers...)
        for (const event of calendarStore.subscriptionEvents) {
            const sub = calendarStore.subscriptions.find(s => event.source === `sub_${s.id}`)
            const color = sub?.color ?? '#06b6d4'
            events.push(toFCEvent(event, color))
        }

		return events
	})

	return {
		isLoading,
		error,
		loadAllSources,
		loadCalDAVEvents,
		loadVikunjaEvents,
		buildFridgeFlowEvents,
		fullCalendarEvents,
	}
}