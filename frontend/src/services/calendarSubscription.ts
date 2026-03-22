import AbstractService from './abstractService'
import type {ICalendarSubscription, ICalendarEvent} from '@/modelTypes/ICalendarSubscription'
import AbstractModel from '@/models/abstractModel'
import type { Permission } from '@/constants/permissions'

class CalendarSubscriptionModel extends AbstractModel<ICalendarSubscription> implements ICalendarSubscription {
	id = 0
	name = ''
	type: ICalendarSubscription['type'] = 'ics'
	color = ''
	url = ''
	username = ''
	password = ''
	created = ''
	updated = ''
	created_by_id = 0
	maxPermission: Permission | null = null

	constructor(data: Partial<ICalendarSubscription> = {}) {
		super()
		this.assignData(data)
	}
}

export default class CalendarSubscriptionService extends AbstractService<ICalendarSubscription> {
	constructor() {
		super({
			getAll: '/calendar-subscriptions',
			create: '/calendar-subscriptions',
			update: '/calendar-subscriptions/{id}',
			delete: '/calendar-subscriptions/{id}',
		})
	}

	modelFactory(data: Partial<ICalendarSubscription>) {
		return new CalendarSubscriptionModel(data)
	}

	async getEvents(subscriptionId: number): Promise<ICalendarEvent[]> {
		const response = await this.http.get<ICalendarEvent[]>(`/calendar-subscriptions/${subscriptionId}/events`)
		return response.data
	}
}
