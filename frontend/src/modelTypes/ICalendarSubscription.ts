import type { Permission } from '@/constants/permissions'

export type CalendarSubscriptionType = 'ics' | 'caldav' | 'apple'

export interface ICalendarSubscription {
	id: number
	name: string
	type: CalendarSubscriptionType
	color: string
	url?: string
	// Write-only fields — only sent on create/update, never returned by the server
	username?: string
	password?: string
	created: string
	updated: string
	created_by_id: number
	maxPermission: Permission | null
}

export interface ICalendarEvent {
	id: string
	title: string
	start: string
	end: string
	allDay: boolean
	description?: string
	sourceId: number
}
