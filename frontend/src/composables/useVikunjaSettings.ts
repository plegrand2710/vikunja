import { useAuthStore } from '@/stores/auth'
import { useCalendarStore } from '@/stores/calendar'
import { useTaskDefaultsStore } from '@/stores/taskDefaults'

let isSyncing = false

export function useVikunjaSettings() {
	const authStore = useAuthStore()
	const calendarStore = useCalendarStore()
	const taskDefaultsStore = useTaskDefaultsStore()

	function loadFromVikunja() {
		if (isSyncing) return
		const fs = authStore.settings?.frontendSettings as Record<string, unknown>
		if (!fs) return

		isSyncing = true
		try {
			if (fs.disabledCalendarSubscriptions && Array.isArray(fs.disabledCalendarSubscriptions)) {
				calendarStore.setDisabledSubscriptions(fs.disabledCalendarSubscriptions as number[])
			}
			if (fs.taskDefaults && typeof fs.taskDefaults === 'object') {
				const current = JSON.stringify(taskDefaultsStore.defaults)
				const incoming = JSON.stringify(fs.taskDefaults)
				if (current !== incoming) {
					taskDefaultsStore.update(fs.taskDefaults as never)
				}
			}
		} finally {
			isSyncing = false
		}
	}

	async function saveDisabledSubscriptions() {
		if (isSyncing) return
		isSyncing = true
		try {
			const newSettings = {
				...authStore.settings,
				frontendSettings: {
					...authStore.settings.frontendSettings,
					disabledCalendarSubscriptions: calendarStore.disabledSubscriptionIds,
				},
			}
			await authStore.saveUserSettings({ settings: newSettings, showMessage: false })
		} finally {
			isSyncing = false
		}
	}

	async function saveSources() {
		if (isSyncing) return
		isSyncing = true
		try {
			const newSettings = {
				...authStore.settings,
				frontendSettings: {
					...authStore.settings.frontendSettings,
					calendarSources: calendarStore.sources,
				},
			}
			await authStore.saveUserSettings({ settings: newSettings, showMessage: false })
		} finally {
			isSyncing = false
		}
	}

	async function saveTaskDefaults() {
		if (isSyncing) return
		isSyncing = true
		try {
			const newSettings = {
				...authStore.settings,
				frontendSettings: {
					...authStore.settings.frontendSettings,
					taskDefaults: taskDefaultsStore.defaults,
				},
			}
			await authStore.saveUserSettings({ settings: newSettings, showMessage: false })
		} finally {
			isSyncing = false
		}
	}

	return {
		loadFromVikunja,
		saveDisabledSubscriptions,
		saveSources,
		saveTaskDefaults,
	}
}
