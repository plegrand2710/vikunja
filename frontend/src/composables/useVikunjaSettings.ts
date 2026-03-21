import { useAuthStore } from '@/stores/auth'
import { useCalendarStore } from '@/stores/calendar'
import type { CalendarSubscription } from '@/stores/calendar'
import { useTaskDefaultsStore } from '@/stores/taskDefaults'

let isSyncing = false
let callDepth = 0

export function useVikunjaSettings() {
  const authStore = useAuthStore()
  const calendarStore = useCalendarStore()
  const taskDefaultsStore = useTaskDefaultsStore()

  function loadFromVikunja() {
    callDepth++
    console.log(`[VSettings] loadFromVikunja called depth=${callDepth} isSyncing=${isSyncing}`)
    console.trace()
    if (callDepth > 3) { callDepth--; return }
    if (isSyncing) { callDepth--; return }
    const fs = authStore.settings?.frontendSettings as Record<string, unknown>
    if (!fs) { callDepth--; return }

    isSyncing = true
    try {
      if (fs.calendarSubscriptions && Array.isArray(fs.calendarSubscriptions)) {
        const current = JSON.stringify(calendarStore.subscriptions)
        const incoming = JSON.stringify(fs.calendarSubscriptions)
        if (current !== incoming) {
          calendarStore.setSubscriptions(fs.calendarSubscriptions as CalendarSubscription[])
        }
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
      callDepth--
    }
  }

  async function saveSubscriptions() {
    console.log(`[VSettings] saveSubscriptions called isSyncing=${isSyncing}`)
    console.trace()
    if (isSyncing) return
    isSyncing = true
    try {
      const newSettings = {
        ...authStore.settings,
        frontendSettings: {
          ...authStore.settings.frontendSettings,
          calendarSubscriptions: calendarStore.subscriptions,
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
    saveSubscriptions,
    saveSources,
    saveTaskDefaults,
  }
}
