/**
 * Composable useSubscriptions
 *
 * Fetches calendar events from shared subscriptions via the backend API.
 * Credentials never leave the server.
 */

import { ref } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import type { CalendarEvent, EventSource } from '@/stores/calendar'
import type { ICalendarSubscription } from '@/modelTypes/ICalendarSubscription'
import CalendarSubscriptionService from '@/services/calendarSubscription'

const service = new CalendarSubscriptionService()

export function useSubscriptions() {
	const store = useCalendarStore()
	const isLoading = ref(false)
	const error = ref<string | null>(null)

	/**
   * Test a subscription by asking the backend to fetch a single event.
   * Returns true if the backend can reach the calendar successfully.
   */
	async function testSubscription(sub: Partial<ICalendarSubscription> & { id?: number }): Promise<boolean> {
		if (!sub.id) return false
		isLoading.value = true
		error.value = null
		try {
			const events = await service.getEvents(sub.id)
			return Array.isArray(events)
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Erreur de connexion'
			return false
		} finally {
			isLoading.value = false
		}
	}

	/**
   * Fetch events for a single subscription from the backend.
   * Only fetches if the subscription is enabled for the current user.
   */
	async function fetchSubscriptionEvents(sub: ICalendarSubscription): Promise<CalendarEvent[]> {
		if (!store.isSubscriptionEnabled(sub.id)) return []

		const source = `sub_${sub.id}` as EventSource
		const color = sub.color ?? '#06b6d4'

		try {
			const backendEvents = await service.getEvents(sub.id)
			return backendEvents.map(e => ({
				id: e.id,
				title: e.title,
				start: e.start,
				end: e.end,
				allDay: e.allDay,
				source,
				color,
				description: e.description,
				recurrence: 'none' as const,
			}))
		} catch (e) {
			console.error(`[useSubscriptions] Error fetching events for subscription ${sub.id}:`, e)
			return []
		}
	}

	/**
   * Fetch events for all enabled shared subscriptions.
   */
	async function fetchAllSubscriptions(): Promise<CalendarEvent[]> {
		const allEvents: CalendarEvent[] = []
		for (const sub of store.sharedSubscriptions) {
			if (!store.isSubscriptionEnabled(sub.id)) continue
			allEvents.push(...await fetchSubscriptionEvents(sub))
		}
		return allEvents
	}

	/**
   * Load the list of shared subscriptions from the backend into the store.
   */
	async function loadSharedSubscriptions(): Promise<void> {
		try {
			const subs = await service.getAll()
			store.setSharedSubscriptions(subs)
		} catch (e) {
			console.error('[useSubscriptions] Failed to load shared subscriptions:', e)
		}
	}

	return {
		isLoading,
		error,
		testSubscription,
		fetchSubscriptionEvents,
		fetchAllSubscriptions,
		loadSharedSubscriptions,
	}
}
