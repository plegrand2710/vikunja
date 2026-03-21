/**
 * Store taskDefaults
 * Stocke un profil de valeurs par défaut appliquées
 * automatiquement à chaque nouvelle tâche créée.
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface TaskDefaults {
  priority: number | null        // 0=aucune, 1=faible, 2=moyenne, 3=haute, 4=urgente
  labels: number[]               // IDs des étiquettes à ajouter
  dueDateOffsetDays: number | null // null = pas de date, 0 = aujourd'hui, 7 = dans 7 jours
  assignees: number[]            // IDs des utilisateurs à assigner
}

const STORAGE_KEY = 'task_defaults'

function load(): TaskDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {
      priority: null,
      labels: [],
      dueDateOffsetDays: null,
      assignees: [],
    }
  } catch {
    return { priority: null, labels: [], dueDateOffsetDays: null, assignees: [] }
  }
}

function save(defaults: TaskDefaults) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
}

export const useTaskDefaultsStore = defineStore('taskDefaults', () => {
  const defaults = ref<TaskDefaults>(load())

  const hasAnyDefault = computed(() =>
    defaults.value.priority !== null ||
    defaults.value.labels.length > 0 ||
    defaults.value.dueDateOffsetDays !== null ||
    defaults.value.assignees.length > 0
  )

  function update(newDefaults: Partial<TaskDefaults>) {
    defaults.value = { ...defaults.value, ...newDefaults }
    save(defaults.value)
  }

  function reset() {
    defaults.value = { priority: null, labels: [], dueDateOffsetDays: null, assignees: [] }
    save(defaults.value)
  }

  function buildDueDate(): string | null {
    if (defaults.value.dueDateOffsetDays === null) return null
    const date = new Date()
    date.setDate(date.getDate() + defaults.value.dueDateOffsetDays)
    date.setHours(23, 59, 0, 0)
    return date.toISOString()
  }

  return { defaults, hasAnyDefault, update, reset, buildDueDate }
})