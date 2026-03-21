<template>
	<div class="task-defaults">
		<div class="task-defaults__header">
			<h3>⚙️ Valeurs par défaut des tâches</h3>
			<p class="task-defaults__subtitle">
				Ces valeurs sont appliquées automatiquement à chaque nouvelle tâche créée.
			</p>
		</div>

		<div class="task-defaults__body">

			<!-- Priorité -->
			<div class="task-defaults__field">
				<label>Priorité par défaut</label>
				<div class="task-defaults__priority-btns">
					<button
						class="task-defaults__priority-btn"
						:class="{ 'is-active': store.defaults.priority === null }"
						@click="updateDefault({ priority: null })"
					>
						Aucune
					</button>
					<button
						v-for="p in PRIORITIES"
						:key="p.value"
						class="task-defaults__priority-btn"
						:class="{ 'is-active': store.defaults.priority === p.value }"
						:style="store.defaults.priority === p.value ? { background: p.color, borderColor: p.color, color: '#fff' } : {}"
						@click="updateDefault({ priority: p.value })"
					>
						{{ p.icon }} {{ p.label }}
					</button>
				</div>
			</div>

			<!-- Date d'échéance -->
			<div class="task-defaults__field">
				<label>Date d'échéance par défaut</label>
				<div class="task-defaults__due-btns">
					<button
						class="task-defaults__due-btn"
						:class="{ 'is-active': store.defaults.dueDateOffsetDays === null }"
						@click="updateDefault({ dueDateOffsetDays: null })"
					>
						Aucune
					</button>
					<button
						v-for="opt in DUE_OPTIONS"
						:key="opt.value"
						class="task-defaults__due-btn"
						:class="{ 'is-active': store.defaults.dueDateOffsetDays === opt.value }"
						@click="updateDefault({ dueDateOffsetDays: opt.value })"
					>
						{{ opt.label }}
					</button>
					<!-- Valeur personnalisée -->
					<div class="task-defaults__due-custom">
						<input
							v-model.number="customDays"
							type="number"
							min="1"
							max="365"
							placeholder="X jours"
							class="task-defaults__input task-defaults__input--small"
							@change="updateDefault({ dueDateOffsetDays: customDays })"
						/>
						<span class="task-defaults__due-label">jours</span>
					</div>
				</div>
			</div>

			<!-- Étiquettes -->
			<div class="task-defaults__field">
				<label>Étiquettes par défaut</label>
				<div class="task-defaults__tags">
					<button
						v-for="label in availableLabels"
						:key="label.id"
						class="task-defaults__tag"
						:class="{ 'is-active': store.defaults.labels.includes(label.id) }"
						:style="store.defaults.labels.includes(label.id)
							? { background: label.hexColor || '#7c3aed', color: '#fff', borderColor: label.hexColor || '#7c3aed' }
							: {}"
						@click="toggleLabel(label.id)"
					>
						{{ label.title }}
					</button>
					<span
						v-if="availableLabels.length === 0"
						class="task-defaults__empty"
					>
						Aucune étiquette disponible — créez-en d'abord dans Vikunja.
					</span>
				</div>
			</div>

			<!-- Assigné à -->
			<div class="task-defaults__field">
				<label>Assigner à (moi par défaut)</label>
				<div class="task-defaults__assignees">
					<button
						class="task-defaults__assignee-btn"
						:class="{ 'is-active': store.defaults.assignees.includes(currentUserId) }"
						@click="toggleAssignee(currentUserId)"
					>
						👤 Moi ({{ currentUsername }})
					</button>
				</div>
				<p class="task-defaults__hint">
					D'autres assignés peuvent être ajoutés manuellement par tâche.
				</p>
			</div>

		</div>

		<!-- Footer -->
		<div class="task-defaults__footer">
			<div
				v-if="store.hasAnyDefault"
				class="task-defaults__summary"
			>
				<span
					v-if="store.defaults.priority !== null"
					class="task-defaults__badge"
				>
					{{ PRIORITIES.find(p => p.value === store.defaults.priority)?.icon }}
					{{ PRIORITIES.find(p => p.value === store.defaults.priority)?.label }}
				</span>
				<span
					v-if="store.defaults.dueDateOffsetDays !== null"
					class="task-defaults__badge"
				>
					📅 Dans {{ store.defaults.dueDateOffsetDays === 0 ? 'aujourd\'hui' : store.defaults.dueDateOffsetDays + ' jours' }}
				</span>
				<span
					v-for="labelId in store.defaults.labels"
					:key="labelId"
					class="task-defaults__badge"
				>
					🏷️ {{ getLabelName(labelId) }}
				</span>
				<span
					v-if="store.defaults.assignees.includes(currentUserId)"
					class="task-defaults__badge"
				>
					👤 Moi
				</span>
			</div>
			<button
				v-if="store.hasAnyDefault"
				class="task-defaults__reset-btn"
				@click="resetDefaults()"
			>
				🗑️ Réinitialiser tous les défauts
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useTaskDefaultsStore } from '@/stores/taskDefaults'
import { useLabelStore } from '@/stores/labels'
import { useAuthStore } from '@/stores/auth'
import { useVikunjaSettings } from '@/composables/useVikunjaSettings'

const store = useTaskDefaultsStore()
const labelStore = useLabelStore()
const authStore = useAuthStore()
const vikunjaSettings = useVikunjaSettings()

// ── Constantes ────────────────────────────────

const PRIORITIES = [
	{ value: 1, label: 'Faible',   icon: '🔵', color: '#3b82f6' },
	{ value: 2, label: 'Moyenne',  icon: '🟡', color: '#f59e0b' },
	{ value: 3, label: 'Haute',    icon: '🟠', color: '#f97316' },
	{ value: 4, label: 'Urgente',  icon: '🔴', color: '#ef4444' },
]

const DUE_OPTIONS = [
	{ value: 0,  label: "Aujourd'hui" },
	{ value: 1,  label: 'Demain' },
	{ value: 3,  label: '3 jours' },
	{ value: 7,  label: '1 semaine' },
	{ value: 14, label: '2 semaines' },
	{ value: 30, label: '1 mois' },
]

// ── State ─────────────────────────────────────

const customDays = ref<number>(
	store.defaults.dueDateOffsetDays !== null &&
	!DUE_OPTIONS.some(o => o.value === store.defaults.dueDateOffsetDays)
		? store.defaults.dueDateOffsetDays
		: 7
)

// ── Données Vikunja ───────────────────────────

const availableLabels = computed(() =>
	Object.values(labelStore.labels)
)

const currentUserId = computed(() => authStore.info?.id ?? 0)
const currentUsername = computed(() => authStore.info?.username ?? 'moi')

function getLabelName(id: number): string {
	return labelStore.labels[id]?.title ?? `#${id}`
}

// ── Actions ───────────────────────────────────

function toggleLabel(id: number) {
	const current = [...store.defaults.labels]
	const idx = current.indexOf(id)
	if (idx === -1) {
		current.push(id)
	} else {
		current.splice(idx, 1)
	}
	store.update({ labels: current })
  vikunjaSettings.saveTaskDefaults()
}

function updateDefault(partial: Parameters<typeof store.update>[0]) {
  store.update(partial)
  vikunjaSettings.saveTaskDefaults()
}

function resetDefaults() {
  store.reset()
  vikunjaSettings.saveTaskDefaults()
}

function toggleAssignee(id: number) {
	const current = [...store.defaults.assignees]
	const idx = current.indexOf(id)
	if (idx === -1) {
		current.push(id)
	} else {
		current.splice(idx, 1)
	}
	store.update({ assignees: current })
  vikunjaSettings.saveTaskDefaults()
}
</script>

<style lang="scss" scoped>
.task-defaults {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-defaults__header {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--grey-200, #e8e8e8);
  margin-bottom: 1.5rem;

  h3 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: var(--text, #fff);
  }
}

.task-defaults__subtitle {
  font-size: 0.82rem;
  color: var(--grey-500, #888);
  margin: 0;
}

.task-defaults__body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.task-defaults__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--grey-500, #888);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

// ── Priorité ──────────────────────────────────

.task-defaults__priority-btns {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.task-defaults__priority-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--grey-300, #444);
  background: transparent;
  color: var(--text, #fff);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba(255,255,255,0.08); }
  &.is-active {
    background: var(--primary, #1973ff);
    border-color: var(--primary, #1973ff);
    color: white;
  }
}

// ── Date d'échéance ───────────────────────────

.task-defaults__due-btns {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.task-defaults__due-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--grey-300, #444);
  background: transparent;
  color: var(--text, #fff);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba(255,255,255,0.08); }
  &.is-active {
    background: var(--primary, #1973ff);
    border-color: var(--primary, #1973ff);
    color: white;
  }
}

.task-defaults__due-custom {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.task-defaults__due-label {
  font-size: 0.82rem;
  color: var(--grey-500, #888);
}

.task-defaults__input {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--grey-300, #444);
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: var(--text, #fff);
  font-size: 0.82rem;
  outline: none;

  &--small { width: 70px; }
  &:focus { border-color: var(--primary, #1973ff); }
}

// ── Étiquettes ────────────────────────────────

.task-defaults__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.task-defaults__tag {
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--grey-300, #444);
  background: transparent;
  color: var(--text, #fff);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba(255,255,255,0.08); }
}

.task-defaults__empty {
  font-size: 0.78rem;
  color: var(--grey-500, #888);
  font-style: italic;
}

// ── Assignés ──────────────────────────────────

.task-defaults__assignees {
  display: flex;
  gap: 0.4rem;
}

.task-defaults__assignee-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--grey-300, #444);
  background: transparent;
  color: var(--text, #fff);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba(255,255,255,0.08); }
  &.is-active {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }
}

.task-defaults__hint {
  font-size: 0.72rem;
  color: var(--grey-500, #888);
  margin: 0;
}

// ── Footer ────────────────────────────────────

.task-defaults__footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--grey-200, #e8e8e8);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.task-defaults__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.task-defaults__badge {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(25,115,255,0.15);
  color: var(--primary, #1973ff);
  font-size: 0.75rem;
  font-weight: 500;
}

.task-defaults__reset-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(229,62,62,0.4);
  background: transparent;
  color: var(--danger, #e53e3e);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba(229,62,62,0.1); }
}
</style>