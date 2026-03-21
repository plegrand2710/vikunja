<template>
	<Teleport to="body">
		<Transition name="modal">
			<div
				v-if="isOpen"
				class="cal-subs"
			>
				<div
					class="cal-subs__overlay"
					@click="emit('close')"
				/>

				<div class="cal-subs__panel">
					<!-- Header -->
					<div class="cal-subs__header">
						<h3>Abonnements calendrier</h3>
						<button
							class="cal-subs__close"
							@click="emit('close')"
						>
							✕
						</button>
					</div>

					<!-- Liste des abonnements existants -->
					<div class="cal-subs__list">
						<div
							v-if="store.subscriptions.length === 0"
							class="cal-subs__empty"
						>
							Aucun abonnement. Ajoutez votre premier calendrier externe.
						</div>

						<div
							v-for="sub in store.subscriptions"
							:key="sub.id"
							class="cal-subs__item"
							:class="{ 'is-disabled': !sub.enabled }"
						>
							<div
								class="cal-subs__item-color"
								:style="{ background: sub.color }"
							/>
							<div class="cal-subs__item-info">
								<span class="cal-subs__item-name">{{ sub.name }}</span>
								<span class="cal-subs__item-type">{{ typeLabel[sub.type] }}</span>
								<span
									v-if="sub.lastSync"
									class="cal-subs__item-sync"
								>
									Sync {{ formatSyncTime(sub.lastSync) }}
								</span>
								<span
									v-if="sub.error"
									class="cal-subs__item-error"
									:title="sub.error"
								>
									⚠️ {{ sub.error }}
								</span>
							</div>
							<div class="cal-subs__item-actions">
								<button
									class="cal-subs__item-btn"
									:title="sub.enabled ? 'Désactiver' : 'Activer'"
									@click="handleToggle(sub.id, sub.enabled)"
								>
									{{ sub.enabled ? '👁️' : '🙈' }}
								</button>
								<button
									class="cal-subs__item-btn"
									title="Modifier"
									@click="handleEdit(sub)"
								>
									✏️
								</button>
								<button
									class="cal-subs__item-btn cal-subs__item-btn--danger"
									title="Supprimer"
									@click="handleDelete(sub.id, sub.name)"
								>
									🗑️
								</button>
							</div>
						</div>
					</div>

					<!-- Bouton ajouter -->
					<button
						v-if="!showForm"
						class="cal-subs__add-btn"
						@click="showForm = true"
					>
						+ Ajouter un abonnement
					</button>

					<!-- Formulaire d'ajout/édition -->
					<div
						v-if="showForm"
						class="cal-subs__form"
					>
						<div class="cal-subs__form-header">
							<h4>{{ editingId ? 'Modifier' : 'Nouvel abonnement' }}</h4>
							<button
								class="cal-subs__close"
								@click="resetForm"
							>
								✕
							</button>
						</div>

						<!-- Type -->
						<div class="cal-subs__field">
							<label>Type</label>
							<div class="cal-subs__type-btns">
								<button
									v-for="t in TYPES"
									:key="t.value"
									class="cal-subs__type-btn"
									:class="{ 'is-active': form.type === t.value }"
									@click="form.type = t.value"
								>
									{{ t.icon }} {{ t.label }}
								</button>
							</div>
						</div>

						<!-- Nom + couleur -->
						<div class="cal-subs__row">
							<div class="cal-subs__field">
								<label>Nom *</label>
								<input
									v-model="form.name"
									type="text"
									:placeholder="namePlaceholder"
									class="cal-subs__input"
								/>
							</div>
							<div class="cal-subs__field cal-subs__field--small">
								<label>Couleur</label>
								<div class="cal-subs__colors">
									<button
										v-for="color in COLORS"
										:key="color"
										class="cal-subs__color-btn"
										:class="{ 'is-active': form.color === color }"
										:style="{ background: color }"
										@click="form.color = color"
									/>
								</div>
							</div>
						</div>

						<!-- Champs selon le type -->

						<!-- CalDAV direct -->
						<template v-if="form.type === 'caldav'">
							<div class="cal-subs__field">
								<label>URL CalDAV *</label>
								<input
									v-model="form.url"
									type="text"
									placeholder="https://cloud.example.com/remote.php/dav/calendars/alice/"
									class="cal-subs__input"
								/>
							</div>
							<div class="cal-subs__row">
								<div class="cal-subs__field">
									<label>Utilisateur</label>
									<input
										v-model="form.username"
										type="text"
										class="cal-subs__input"
									/>
								</div>
								<div class="cal-subs__field">
									<label>Mot de passe</label>
									<input
										v-model="form.password"
										type="password"
										class="cal-subs__input"
									/>
								</div>
							</div>
						</template>

						<!-- Apple Calendar -->
						<template v-else-if="form.type === 'apple'">
							<div class="cal-subs__info">
								🔑 Utilise un <strong>mot de passe spécifique à l'app</strong> généré sur
								<a
									href="https://appleid.apple.com"
									target="_blank"
								>appleid.apple.com</a>
								→ Sécurité → Mots de passe spécifiques aux apps.
							</div>
							<div class="cal-subs__field">
								<label>Apple ID *</label>
								<input
									v-model="form.appleUsername"
									type="email"
									placeholder="alice@icloud.com"
									class="cal-subs__input"
								/>
							</div>
							<div class="cal-subs__field">
								<label>App-specific password *</label>
								<input
									v-model="form.applePassword"
									type="password"
									placeholder="xxxx-xxxx-xxxx-xxxx"
									class="cal-subs__input"
								/>
							</div>
						</template>

						<!-- Google Calendar -->
						<template v-else-if="form.type === 'google'">
							<div class="cal-subs__info">
								⚙️ Google Calendar nécessite une configuration côté serveur via Vdirsyncer.
								Renseigne tes identifiants OAuth et suis les instructions générées.
							</div>
							<div class="cal-subs__field">
								<label>Client ID *</label>
								<input
									v-model="form.googleClientId"
									type="text"
									placeholder="xxxx.apps.googleusercontent.com"
									class="cal-subs__input"
								/>
							</div>
							<div class="cal-subs__field">
								<label>Client Secret *</label>
								<input
									v-model="form.googleClientSecret"
									type="password"
									class="cal-subs__input"
								/>
							</div>

							<!-- Config Vdirsyncer générée -->
							<div
								v-if="form.googleClientId && form.googleClientSecret && form.name"
								class="cal-subs__vdirsyncer"
							>
								<div class="cal-subs__vdirsyncer-header">
									<span>Config Vdirsyncer à ajouter sur NixOS</span>
									<button
										class="cal-subs__copy-btn"
										@click="copyVdirsyncerConfig"
									>
										{{ copied ? '✓ Copié' : '📋 Copier' }}
									</button>
								</div>
								<pre class="cal-subs__vdirsyncer-code">{{ vdirsyncerConfig }}</pre>
							</div>
						</template>

						<!-- ICS lecture seule -->
						<template v-else-if="form.type === 'ics'">
							<div class="cal-subs__field">
								<label>URL ICS *</label>
								<input
									v-model="form.icsUrl"
									type="text"
									placeholder="https://example.com/calendrier.ics"
									class="cal-subs__input"
								/>
							</div>
							<div class="cal-subs__info">
								📖 Lecture seule — les événements sont importés mais non modifiables.
							</div>
						</template>

						<!-- Test + résultat -->
						<div
							v-if="testResult !== null"
							class="cal-subs__test-result"
							:class="testResult ? 'is-success' : 'is-error'"
						>
							{{ testResult ? '✅ Connexion réussie !' : `❌ ${subs.error.value}` }}
						</div>

						<!-- Footer du formulaire -->
						<div class="cal-subs__form-footer">
							<button
								class="cal-subs__btn"
								:disabled="!canTest || subs.isLoading.value"
								@click="handleTest"
							>
								{{ subs.isLoading.value ? 'Test...' : 'Tester' }}
							</button>
							<button
								class="cal-subs__btn cal-subs__btn--primary"
								:disabled="!canSave"
								@click="handleSave"
							>
								{{ editingId ? 'Enregistrer' : 'Ajouter' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useSubscriptions } from '@/composables/useSubscriptions'
import type { CalendarSubscription, SubscriptionType } from '@/stores/calendar'
import { useVikunjaSettings } from '@/composables/useVikunjaSettings'
import { useCalendarSources } from '@/composables/useCalendarSources'

defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'refresh'): void }>()

const store = useCalendarStore()
const subs = useSubscriptions()
const vikunjaSettings = useVikunjaSettings()
const calendarSources = useCalendarSources()

let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => store.subscriptions,
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      vikunjaSettings.saveSubscriptions()
    }, 1000)
  },
  { deep: true }
)

// ── Constantes ────────────────────────────────

const TYPES: { value: SubscriptionType; label: string; icon: string }[] = [
  { value: 'caldav', label: 'CalDAV', icon: '🌐' },
  { value: 'apple', label: 'Apple', icon: '🍎' },
  { value: 'ics', label: 'ICS', icon: '📅' },
]

const typeLabel: Record<SubscriptionType, string> = {
  caldav: '🌐 CalDAV',
  google: '🔴 Google (ICS)',
  apple: '🍎 Apple',
  ics: '📅 ICS (lecture seule)',
}

const COLORS = [
  '#ea4335', '#1973ff', '#10b981', '#f59e0b',
  '#7c3aed', '#ec4899', '#06b6d4', '#555555',
]

// ── État du formulaire ────────────────────────

const showForm = ref(false)
const editingId = ref<string | null>(null)
const testResult = ref<boolean | null>(null)
const copied = ref(false)

const form = reactive({
  type: 'caldav' as SubscriptionType,
  name: '',
  color: COLORS[0],
  enabled: true,
  url: '',
  username: '',
  password: '',
  icsUrl: '',
  googleClientId: '',
  googleClientSecret: '',
  appleUsername: '',
  applePassword: '',
})

// ── Computed ──────────────────────────────────

const namePlaceholder = computed(() => ({
  caldav: 'Mon Nextcloud',
  google: 'Google Pro',
  apple: 'iCloud Perso',
  ics: 'Jours fériés',
}[form.type]))

const canTest = computed(() => {
  if (!form.name.trim()) return false
  if (form.type === 'caldav') return !!form.url
  if (form.type === 'apple') return !!form.appleUsername && !!form.applePassword
  if (form.type === 'ics') return !!form.icsUrl
  if (form.type === 'google') return !!form.googleClientId && !!form.googleClientSecret
  return false
})

const canSave = computed(() => canTest.value)

const vdirsyncerConfig = computed(() => {
  if (form.type !== 'google') return ''
  return subs.generateVdirsyncerConfig({
    id: editingId.value ?? 'new',
    name: form.name,
    type: 'google',
    color: form.color,
    enabled: true,
    googleClientId: form.googleClientId,
    googleClientSecret: form.googleClientSecret,
  })
})

// ── Helpers ───────────────────────────────────

function formatSyncTime(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000 / 60)
  if (diff < 1) return 'à l\'instant'
  if (diff < 60) return `il y a ${diff}min`
  return `il y a ${Math.floor(diff / 60)}h`
}

function resetForm()
{
  showForm.value = false
  editingId.value = null
  testResult.value = null
  form.type = 'caldav'
  form.name = ''
  form.color = COLORS[0]
  form.url = ''
  form.username = ''
  form.password = ''
  form.icsUrl = ''
  form.googleClientId = ''
  form.googleClientSecret = ''
  form.appleUsername = ''
  form.applePassword = ''
}

function handleEdit(sub: CalendarSubscription) {
  editingId.value = sub.id
  form.type = sub.type
  form.name = sub.name
  form.color = sub.color
  form.url = sub.url ?? ''
  form.username = sub.username ?? ''
  form.password = sub.password ?? ''
  form.icsUrl = sub.icsUrl ?? ''
  form.googleClientId = sub.googleClientId ?? ''
  form.googleClientSecret = sub.googleClientSecret ?? ''
  form.appleUsername = sub.appleUsername ?? ''
  form.applePassword = sub.applePassword ?? ''
  showForm.value = true
  testResult.value = null
}

function handleDelete(id: string, name: string) {
  if (confirm(`Supprimer l'abonnement "${name}" ?`)) {
    store.deleteSubscription(id)
  }
}

function handleToggle(id: string, enabled: boolean) {
  store.updateSubscription(id, { enabled: !enabled })
}

async function handleTest() {
  testResult.value = await subs.testSubscription({ ...form })
}

async function handleSave() {
  try {
    const subData = {
      name: form.name,
      type: form.type,
      color: form.color,
      enabled: true,
      url: form.url || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
      icsUrl: form.icsUrl || undefined,
      googleClientId: form.googleClientId || undefined,
      googleClientSecret: form.googleClientSecret || undefined,
      appleUsername: form.appleUsername || undefined,
      applePassword: form.applePassword || undefined,
    }
    if (editingId.value) {
      store.updateSubscription(editingId.value, subData)
    } else {
      store.addSubscription(subData)
    }
    resetForm()
    await calendarSources.loadAllSources()
    emit('refresh')
  } catch(e) {
    console.error('[handleSave] ERREUR:', e)
  }
}

async function copyVdirsyncerConfig() {
  await navigator.clipboard.writeText(vdirsyncerConfig.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style lang="scss" scoped>
.cal-subs {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.cal-subs__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}

.cal-subs__panel {
  position: relative;
  background: var(--content-background, white);
  border-radius: 16px;
  width: min(560px, 100%);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.25);
  overflow: hidden;
}

// ── Header ────────────────────────────────────

.cal-subs__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid var(--grey-200, #e8e8e8);
  flex-shrink: 0;

  h3 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
    color: var(--text, #fff);
  }
}

.cal-subs__close {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  color: var(--grey-500, #888);

  &:hover { background: var(--grey-100, rgba(255,255,255,0.1)); }
}

// ── Liste ──────────────────────────────────────

.cal-subs__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cal-subs__empty {
  text-align: center;
  color: var(--grey-500, #888);
  font-size: 0.875rem;
  padding: 1.5rem 0;
  font-style: italic;
}

.cal-subs__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--grey-200, #e8e8e8);
  background: var(--grey-50, rgba(255,255,255,0.05));
  transition: opacity 0.15s;

  &.is-disabled {
    opacity: 0.45;
  }
}

.cal-subs__item-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cal-subs__item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.cal-subs__item-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cal-subs__item-type {
  font-size: 0.72rem;
  color: var(--grey-500, #888);
}

.cal-subs__item-sync {
  font-size: 0.7rem;
  color: var(--grey-400, #bbb);
}

.cal-subs__item-error {
  font-size: 0.7rem;
  color: var(--danger, #e53e3e);
}

.cal-subs__item-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.cal-subs__item-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem 0.35rem;
  border-radius: 5px;
  font-size: 0.85rem;
  transition: background 0.15s;

  &:hover { background: var(--grey-200, rgba(255,255,255,0.1)); }
  &--danger:hover { background: rgba(229,62,62,0.15); }
}

// ── Bouton ajouter ────────────────────────────

.cal-subs__add-btn {
  margin: 0.75rem 1.25rem 1rem;
  padding: 0.6rem;
  border: 2px dashed var(--grey-300, #555);
  border-radius: 10px;
  background: transparent;
  color: var(--grey-500, #888);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: border-color 0.15s, color 0.15s;

  &:hover {
    border-color: var(--primary, #1973ff);
    color: var(--primary, #1973ff);
  }
}

// ── Formulaire ────────────────────────────────

.cal-subs__form {
  border-top: 1px solid var(--grey-200, #e8e8e8);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  overflow-y: auto;
  max-height: 55vh;
}

.cal-subs__form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h4 {
    font-size: 0.9rem;
    font-weight: 700;
    margin: 0;
    color: var(--text, #fff);
  }
}

.cal-subs__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--grey-500, #888);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &--small { flex: 0 0 auto; }
}

.cal-subs__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.cal-subs__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--grey-300, #444);
  border-radius: 8px;
  font-size: 0.875rem;
  outline: none;
  background: var(--grey-100, rgba(255,255,255,0.05));
  color: var(--text, #fff);
  transition: border-color 0.15s;

  &:focus { border-color: var(--primary, #1973ff); }
  &::placeholder { color: var(--grey-500, #666); }
}

// ── Type buttons ──────────────────────────────

.cal-subs__type-btns {
  display: flex;
  gap: 0.35rem;
}

.cal-subs__type-btn {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--grey-300, #444);
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--grey-500, #888);
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover { background: rgba(255,255,255,0.05); }
  &.is-active {
    background: var(--primary, #1973ff);
    color: white;
    border-color: var(--primary, #1973ff);
  }
}

// ── Couleurs ──────────────────────────────────

.cal-subs__colors {
  display: flex;
  gap: 0.4rem;
}

.cal-subs__color-btn {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;

  &:hover { transform: scale(1.15); }
  &.is-active { border-color: var(--text, #fff); transform: scale(1.15); }
}

// ── Info ──────────────────────────────────────

.cal-subs__info {
  font-size: 0.8rem;
  color: var(--grey-500, #888);
  padding: 0.6rem 0.75rem;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  border-left: 3px solid var(--primary, #1973ff);
  line-height: 1.5;

  a { color: var(--primary, #1973ff); }
  strong { color: var(--text, #fff); }
}

// ── Vdirsyncer config ─────────────────────────

.cal-subs__vdirsyncer {
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  overflow: hidden;
}

.cal-subs__vdirsyncer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.05);
  font-size: 0.75rem;
  color: var(--grey-500, #888);
}

.cal-subs__copy-btn {
  background: none;
  border: none;
  color: var(--primary, #1973ff);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;

  &:hover { background: rgba(25,115,255,0.1); }
}

.cal-subs__vdirsyncer-code {
  font-size: 0.72rem;
  padding: 0.75rem;
  margin: 0;
  overflow-x: auto;
  color: #10b981;
  font-family: 'Courier New', monospace;
  white-space: pre;
}

// ── Test result ───────────────────────────────

.cal-subs__test-result {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;

  &.is-success { background: rgba(16,185,129,0.15); color: #10b981; }
  &.is-error { background: rgba(229,62,62,0.15); color: #e53e3e; }
}

// ── Footer formulaire ─────────────────────────

.cal-subs__form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.cal-subs__btn {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--grey-300, #444);
  background: transparent;
  color: var(--text, #fff);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }

  &--primary {
    background: var(--primary, #1973ff);
    border-color: var(--primary, #1973ff);

    &:hover:not(:disabled) { background: var(--primary-dark, #1560d4); }
  }
}

// ── Transition ────────────────────────────────

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
</style>