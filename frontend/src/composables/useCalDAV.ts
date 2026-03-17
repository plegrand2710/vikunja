/**
 * Composable useCalDAV
 * Client CalDAV pour lire et écrire des événements sur Radicale.
 *
 * Utilise la bibliothèque tsdav pour communiquer avec le serveur CalDAV.
 * Radicale est exposé via Nginx sur /radicale/
 *
 * SÉCURITÉ : les credentials ne sont jamais persistés — ils sont
 * lus depuis le store calendar qui les garde uniquement en mémoire.
 */

import { ref } from 'vue'
import { createDAVClient } from 'tsdav'
import type { DAVCalendar, DAVObject } from 'tsdav'
import { useCalendarStore } from '@/stores/calendar'
import type { CalendarEvent, EventSource } from '@/stores/calendar'
import { SOURCE_COLORS } from '@/stores/calendar'

// ─────────────────────────────────────────────
// TYPES INTERNES
// ─────────────────────────────────────────────

interface ParsedVEvent {
	uid: string
	summary: string
	dtstart: string
	dtend: string
	allDay: boolean
	description?: string
	rrule?: string
	url?: string
}

// ─────────────────────────────────────────────
// HELPERS — Parsing iCal
// ─────────────────────────────────────────────

/**
 * Parse une propriété iCal de type DATE ou DATETIME
 * Retourne un ISO string
 */
function parseICalDate(value: string, param?: string): { date: string; allDay: boolean } {
	// Toute la journée si VALUE=DATE ou pas de T dans la valeur
	const isAllDay = param === 'DATE' || !value.includes('T')

	if (isAllDay) {
		// Format DATE : 20260316 → 2026-03-16T00:00:00
		const y = value.substring(0, 4)
		const m = value.substring(4, 6)
		const d = value.substring(6, 8)
		return { date: `${y}-${m}-${d}T00:00:00`, allDay: true }
	}

	// Format DATETIME : 20260316T100000Z ou 20260316T100000
	const y = value.substring(0, 4)
	const mo = value.substring(4, 6)
	const d = value.substring(6, 8)
	const h = value.substring(9, 11)
	const mi = value.substring(11, 13)
	const s = value.substring(13, 15)
	const utc = value.endsWith('Z') ? 'Z' : ''

	return {
		date: `${y}-${mo}-${d}T${h}:${mi}:${s}${utc}`,
		allDay: false,
	}
}

/**
 * Parse un bloc VEVENT depuis un string iCal
 */
function parseVEvent(vcalendar: string): ParsedVEvent | null {
	const lines = vcalendar
		.replace(/\r\n /g, '')   // unfold les lignes longues
		.replace(/\r\n\t/g, '')
		.split(/\r\n|\n/)

	let inEvent = false
	const props: Record<string, string> = {}
	const params: Record<string, string> = {}

	for (const line of lines) {
		if (line === 'BEGIN:VEVENT') { inEvent = true; continue }
		if (line === 'END:VEVENT') { inEvent = false; continue }
		if (!inEvent) continue

		// Parser "PROP;PARAM=VAL:VALUE" ou "PROP:VALUE"
		const colonIdx = line.indexOf(':')
		if (colonIdx === -1) continue

		const propFull = line.substring(0, colonIdx)
		const value = line.substring(colonIdx + 1)

		const semicolonIdx = propFull.indexOf(';')
		const propName = semicolonIdx !== -1
			? propFull.substring(0, semicolonIdx)
			: propFull
		const paramStr = semicolonIdx !== -1
			? propFull.substring(semicolonIdx + 1)
			: ''

		props[propName] = value

		// Extraire VALUE= des params
		const valueParamMatch = paramStr.match(/VALUE=([^;]+)/)
		if (valueParamMatch) {
			params[propName] = valueParamMatch[1]
		}
	}

	if (!props['UID'] || !props['SUMMARY'] || !props['DTSTART']) return null

	const start = parseICalDate(props['DTSTART'], params['DTSTART'])
	const end = props['DTEND']
		? parseICalDate(props['DTEND'], params['DTEND'])
		: { date: start.date, allDay: start.allDay }

	return {
		uid: props['UID'],
		summary: props['SUMMARY'],
		dtstart: start.date,
		dtend: end.date,
		allDay: start.allDay,
		description: props['DESCRIPTION'],
		rrule: props['RRULE'],
		url: props['URL'],
	}
}

/**
 * Génère un bloc VCALENDAR/VEVENT à partir d'un CalendarEvent
 */
function eventToVCal(event: CalendarEvent): string {
	const formatDate = (iso: string, allDay: boolean): string => {
		if (allDay) {
			return iso.substring(0, 10).replace(/-/g, '')
		}
		return iso.replace(/[-:]/g, '').replace('.000', '').substring(0, 15) + 'Z'
	}

	const dtstart = event.allDay
		? `DTSTART;VALUE=DATE:${formatDate(event.start, true)}`
		: `DTSTART:${formatDate(event.start, false)}`

	const dtend = event.allDay
		? `DTEND;VALUE=DATE:${formatDate(event.end, true)}`
		: `DTEND:${formatDate(event.end, false)}`

	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//FridgeFlow//Vikunja Calendar//EN',
		'BEGIN:VEVENT',
		`UID:${event.id}@fridgeflow`,
		`SUMMARY:${event.title}`,
		dtstart,
		dtend,
	]

	if (event.description) {
		lines.push(`DESCRIPTION:${event.description}`)
	}

	if (event.recurrence && event.recurrence !== 'none') {
		const rrules: Record<string, string> = {
			daily:   'RRULE:FREQ=DAILY',
			weekly:  'RRULE:FREQ=WEEKLY',
			monthly: 'RRULE:FREQ=MONTHLY',
		}
		lines.push(rrules[event.recurrence])
	}

	lines.push('END:VEVENT', 'END:VCALENDAR')
	return lines.join('\r\n')
}

/**
 * Détermine la source d'un calendrier Radicale
 * en lisant son displayName
 */
function inferSource(calendarName: string): EventSource {
	const name = calendarName.toLowerCase()
	if (name.includes('google') || name.includes('gmail')) return 'google'
	if (name.includes('apple') || name.includes('icloud')) return 'apple'
	if (name.includes('partner') || name.includes('conjoint')) return 'partner'
	return 'local'
}

// ─────────────────────────────────────────────
// LE COMPOSABLE
// ─────────────────────────────────────────────

export function useCalDAV() {
	const store = useCalendarStore()
	const isLoading = ref(false)
	const error = ref<string | null>(null)

	/** Crée un client tsdav authentifié */
	async function createClient() {
		if (!store.isCaldavConfigured) {
			throw new Error('Configuration CalDAV manquante. Configure l\'URL et les credentials dans les paramètres.')
		}

		return createDAVClient({
			serverUrl: store.caldavConfig.url,
			credentials: {
				username: store.caldavConfig.username,
				password: store.caldavConfig.password,
			},
			authMethod: 'Basic',
			defaultAccountType: 'caldav',
		})
	}

	/** Wrapper loading + erreur */
	async function withLoading<T>(fn: () => Promise<T>): Promise<T | null> {
		isLoading.value = true
		error.value = null
		try {
			return await fn()
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Erreur CalDAV inconnue'
			console.error('[useCalDAV]', error.value)
			return null
		} finally {
			isLoading.value = false
		}
	}

	/**
	 * Charge tous les événements depuis Radicale
	 * Parcourt tous les calendriers de l'utilisateur
	 */
	async function fetchAllEvents(): Promise<CalendarEvent[]> {
		const result = await withLoading(async () => {
			const client = await createClient()

			// Récupérer tous les calendriers
			const calendars: DAVCalendar[] = await client.fetchCalendars()
			const allEvents: CalendarEvent[] = []

			for (const calendar of calendars) {
				const source = inferSource(calendar.displayName ?? '')

				// Ne pas charger les sources désactivées
				if (!store.activeSourceIds.has(source)) continue

				// Récupérer les objets du calendrier
				const objects: DAVObject[] = await client.fetchCalendarObjects({
					calendar,
				})

				for (const obj of objects) {
					if (!obj.data) continue

					const parsed = parseVEvent(obj.data)
					if (!parsed) continue

					allEvents.push({
						id: parsed.uid,
						title: parsed.summary,
						start: parsed.dtstart,
						end: parsed.dtend,
						allDay: parsed.allDay,
						source,
						color: store.getSource(source)?.color ?? SOURCE_COLORS[source],
						description: parsed.description,
						recurrence: 'none',
						caldavUrl: obj.url,
					})
				}

				// Mettre à jour le statut de sync
				store.updateSourceSyncStatus(source, {
					lastSync: new Date().toISOString(),
					error: undefined,
				})
			}

			return allEvents
		})

		if (result) {
			store.setCaldavEvents(result)
		}

		return result ?? []
	}

	/**
	 * Crée un événement dans Radicale
	 */
	async function createCalDAVEvent(event: CalendarEvent): Promise<boolean> {
		const result = await withLoading(async () => {
			const client = await createClient()
			const calendars = await client.fetchCalendars()

			// Chercher le calendrier "Personnel" (local)
			const personalCal = calendars.find(c =>
				(c.displayName ?? '').toLowerCase().includes('personnel') ||
				(c.displayName ?? '').toLowerCase().includes('personal')
			) ?? calendars[0]

			if (!personalCal) throw new Error('Aucun calendrier trouvé dans Radicale')

			const vcal = eventToVCal(event)
			const filename = `${event.id}.ics`

			await client.createCalendarObject({
				calendar: personalCal,
				filename,
				iCalString: vcal,
			})

			return true
		})

		return result === true
	}

	/**
	 * Met à jour un événement dans Radicale
	 */
	async function updateCalDAVEvent(event: CalendarEvent): Promise<boolean> {
		if (!event.caldavUrl) {
			console.warn('[useCalDAV] Pas d\'URL CalDAV pour cet événement')
			return false
		}

		const result = await withLoading(async () => {
			const client = await createClient()
			const vcal = eventToVCal(event)

			await client.updateCalendarObject({
				calendarObject: {
					url: event.caldavUrl!,
					data: vcal,
					etag: '',
				},
			})

			return true
		})

		return result === true
	}

	/**
	 * Supprime un événement dans Radicale
	 */
	async function deleteCalDAVEvent(event: CalendarEvent): Promise<boolean> {
		if (!event.caldavUrl) {
			console.warn('[useCalDAV] Pas d\'URL CalDAV pour cet événement')
			return false
		}

		const result = await withLoading(async () => {
			const client = await createClient()

			await client.deleteCalendarObject({
				calendarObject: {
					url: event.caldavUrl!,
					data: '',
					etag: '',
				},
			})

			return true
		})

		return result === true
	}

	/**
	 * Teste la connexion CalDAV
	 * Retourne true si les credentials sont valides
	 */
	async function testConnection(): Promise<boolean> {
		const result = await withLoading(async () => {
			const client = await createClient()
			const calendars = await client.fetchCalendars()
			return calendars.length >= 0
		})

		return result === true
	}

	return {
		isLoading,
		error,
		fetchAllEvents,
		createCalDAVEvent,
		updateCalDAVEvent,
		deleteCalDAVEvent,
		testConnection,
	}
}