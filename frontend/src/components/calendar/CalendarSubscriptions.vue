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
						<h3>Abonnements calendrier partagés</h3>
						<button
							class="cal-subs__close"
							@click="emit('close')"
						>
							✕
						</button>
					</div>

					<!-- Liste des abonnements -->
					<div class="cal-subs__list">
						<div
							v-if="isListLoading"
							class="cal-subs__empty"
						>
							Chargement…
						</div>
						<div
							v-else-if="subscriptions.length === 0"
							class="cal-subs__empty"
						>
							Aucun abonnement partagé. Ajoutez le premier calendrier externe.
						</div>

						<div
							v-for="sub in subscriptions"
							:key="sub.id"
							class="cal-subs__item"
							:class="{ 'is-disabled': !store.isSubscriptionEnabled(sub.id) }"
						>
							<div
								class="cal-subs__item-color"
								:style="{ background: sub.color }"
							/>
							<div class="cal-subs__item-info">
								<span class="cal-subs__item-name">{{ sub.name }}</span>
								<span class="cal-subs__item-type">{{ typeLabel[sub.type] }}</span>
								<span class="cal-subs__item-shared">Partagé avec tous</span>
							</div>
							<div class="cal-subs__item-actions">
								<button
									class="cal-subs__item-btn"
									:title="store.isSubscriptionEnabled(sub.id) ? 'Masquer pour moi' : 'Afficher pour moi'"
									@click="handleToggle(sub.id)"
								>
									{{ store.isSubscriptionEnabled(sub.id) ? '👁️' : '🙈' }}
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
									title="Supprimer pour tous"
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
						+ Ajouter un abonnement partagé
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
								>
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

						<!-- ICS -->
						<template v-if="form.type === 'ics'">
							<div class="cal-subs__field">
								<label>URL ICS *</label>
								<input
									v-model="form.url"
									type="text"
									placeholder="https://example.com/calendrier.ics"
									class="cal-subs__input"
								>
							</div>
							<div class="cal-subs__info">
								📖 Lecture seule — les événements sont importés mais non modifiables. Les credentials optionnels permettent les ICS protégés par mot de passe.
							</div>
							<div class="cal-subs__row">
								<div class="cal-subs__field">
									<label>Utilisateur (optionnel)</label>
									<input
										v-model="form.username"
										type="text"
										class="cal-subs__input"
									>
								</div>
								<div class="cal-subs__field">
									<label>Mot de passe (optionnel)</label>
									<input
										v-model="form.password"
										type="password"
										:placeholder="editingId ? '(inchangé si vide)' : ''"
										class="cal-subs__input"
									>
								</div>
							</div>
						</template>

						<!-- CalDAV -->
						<template v-else-if="form.type === 'caldav'">
							<div class="cal-subs__field">
								<label>URL CalDAV *</label>
								<input
									v-model="form.url"
									type="text"
									placeholder="https://cloud.example.com/remote.php/dav/calendars/alice/"
									class="cal-subs__input"
								>
							</div>
							<div class="cal-subs__row">
								<div class="cal-subs__field">
									<label>Utilisateur *</label>
									<input
										v-model="form.username"
										type="text"
										class="cal-subs__input"
									>
								</div>
								<div class="cal-subs__field">
									<label>Mot de passe *</label>
									<input
										v-model="form.password"
										type="password"
										:placeholder="editingId ? '(inchangé si vide)' : ''"
										class="cal-subs__input"
									>
								</div>
							</div>
						</template>

						<!-- Apple -->
						<template v-else-if="form.type === 'apple'">
							<div class="cal-subs__info">
								🔑 Utilise un <strong>mot de passe spécifique à l'app</strong> généré sur
								<a
									href="https://appleid.apple.com"
									target="_blank"
								>appleid.apple.com</a>
								→ Sécurité → Mots de passe spécifiques aux apps.
							</div>
							<div class="cal-subs__row">
								<div class="cal-subs__field">
									<label>Apple ID *</label>
									<input
										v-model="form.username"
										type="email"
										placeholder="alice@icloud.com"
										class="cal-subs__input"
									>
								</div>
								<div class="cal-subs__field">
									<label>App-specific password *</label>
									<input
										v-model="form.password"
										type="password"
										:placeholder="editingId ? '(inchangé si vide)' : 'xxxx-xxxx-xxxx-xxxx'"
										class="cal-subs__input"
									>
								</div>
							</div>
						</template>

						<!-- Info sécurité -->
						<div class="cal-subs__security-info">
							🔒 Les identifiants sont chiffrés sur le serveur. La récupération des événements est effectuée par le serveur — vos credentials ne passent jamais dans le navigateur.
						</div>

						<!-- Test + résultat -->
						<div
							v-if="testResult !== null"
							class="cal-subs__test-result"
							:class="testResult ? 'is-success' : 'is-error'"
						>
							{{ testResult ? '✅ Connexion réussie !' : `❌ ${testError}` }}
						</div>

						<!-- Footer du formulaire -->
						<div class="cal-subs__form-footer">
							<button
								class="cal-subs__btn"
								:disabled="!canSave || isSaving"
								@click="handleSave"
							>
								{{ isSaving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useCalendarSources } from '@/composables/useCalendarSources'
import { useVikunjaSettings } from '@/composables/useVikunjaSettings'
import type { ICalendarSubscription } from '@/modelTypes/ICalendarSubscription'
import CalendarSubscriptionService from '@/services/calendarSubscription'

defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'refresh'): void }>()

const store = useCalendarStore()
const calendarSources = useCalendarSources()
const vikunjaSettings = useVikunjaSettings()
const service = new CalendarSubscriptionService()

// ── Constantes ────────────────────────────────

const TYPES: { value: ICalendarSubscription['type']; label: string; icon: string }[] = [
	{ value: 'ics', label: 'ICS', icon: '📅' },
	{ value: 'caldav', label: 'CalDAV', icon: '🌐' },
	{ value: 'apple', label: 'Apple', icon: '🍎' },
]

const typeLabel: Record<ICalendarSubscription['type'], string> = {
	ics: '📅 ICS (lecture seule)',
	caldav: '🌐 CalDAV',
	apple: '🍎 Apple Calendar',
}

const COLORS = [
	'#ea4335', '#1973ff', '#10b981', '#f59e0b',
	'#7c3aed', '#ec4899', '#06b6d4', '#555555',
]

// ── État ──────────────────────────────────────

const subscriptions = ref<ICalendarSubscription[]>([])
const isListLoading = ref(false)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const testResult = ref<boolean | null>(null)
const testError = ref('')
const isSaving = ref(false)

const form = reactive({
	type: 'ics' as ICalendarSubscription['type'],
	name: '',
	color: COLORS[0],
	url: '',
	username: '',
	password: '',
})

// ── Computed ──────────────────────────────────

const namePlaceholder = computed(() => ({
	ics: 'Jours fériés',
	caldav: 'Mon Nextcloud',
	apple: 'iCloud Perso',
}[form.type]))

const canSave = computed(() => {
	if (!form.name.trim()) return false
	if (form.type === 'ics') return !!form.url.trim()
	if (form.type === 'caldav') return !!form.url.trim()
	if (form.type === 'apple') return !!form.username.trim()
	return false
})

// ── Chargement ────────────────────────────────

async function loadSubscriptions() {
	isListLoading.value = true
	try {
		subscriptions.value = await service.getAll()
		store.setSharedSubscriptions(subscriptions.value)
	} catch (e) {
		console.error('[CalendarSubscriptions] Failed to load:', e)
	} finally {
		isListLoading.value = false
	}
}

onMounted(loadSubscriptions)

// ── Helpers ───────────────────────────────────

function resetForm() {
	showForm.value = false
	editingId.value = null
	testResult.value = null
	testError.value = ''
	form.type = 'ics'
	form.name = ''
	form.color = COLORS[0]
	form.url = ''
	form.username = ''
	form.password = ''
}

function handleEdit(sub: ICalendarSubscription) {
	editingId.value = sub.id
	form.type = sub.type
	form.name = sub.name
	form.color = sub.color
	form.url = sub.url ?? ''
	form.username = '' // never pre-filled for security
	form.password = '' // never pre-filled for security
	showForm.value = true
	testResult.value = null
}

async function handleDelete(id: number, name: string) {
	if (!confirm(`Supprimer l'abonnement "${name}" pour tout le monde ?`)) return
	try {
		await service.delete({ id } as ICalendarSubscription)
		await loadSubscriptions()
		await calendarSources.loadAllSources()
		emit('refresh')
	} catch (e) {
		console.error('[CalendarSubscriptions] Delete failed:', e)
	}
}

async function handleToggle(id: number) {
	store.toggleSubscription(id)
	await vikunjaSettings.saveDisabledSubscriptions()
	await calendarSources.loadAllSources()
	emit('refresh')
}

async function handleSave() {
	isSaving.value = true
	testResult.value = null
	testError.value = ''

	try {
		const payload: Partial<ICalendarSubscription> = {
			name: form.name,
			type: form.type,
			color: form.color,
			url: form.url || undefined,
			username: form.username || undefined,
			password: form.password || undefined,
		}

		if (editingId.value !== null) {
			await service.update({ id: editingId.value, ...payload } as ICalendarSubscription)
		} else {
			await service.create(payload as ICalendarSubscription)
		}

		await loadSubscriptions()
		resetForm()
		await calendarSources.loadAllSources()
		emit('refresh')
	} catch (e) {
		testError.value = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde'
		testResult.value = false
	} finally {
		isSaving.value = false
	}
}

// Sync toggle state from settings on open
watch(() => store.disabledSubscriptionIds, () => {}, { immediate: true })
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
  inline-size: min(560px, 100%);
  max-block-size: 85vh;
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
  border-block-end: 1px solid var(--grey-200, #e8e8e8);
  flex-shrink: 0;

  h3 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
    color: var(--text, #ffffff);
  }
}

.cal-subs__close {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  color: var(--grey-500, #888888);

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
  color: var(--grey-500, #888888);
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
  inline-size: 12px;
  block-size: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cal-subs__item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-inline-size: 0;
}

.cal-subs__item-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cal-subs__item-type {
  font-size: 0.72rem;
  color: var(--grey-500, #888888);
}

.cal-subs__item-shared {
  font-size: 0.7rem;
  color: var(--primary, #1973ff);
  font-style: italic;
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
  border: 2px dashed var(--grey-300, #555555);
  border-radius: 10px;
  background: transparent;
  color: var(--grey-500, #888888);
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
  border-block-start: 1px solid var(--grey-200, #e8e8e8);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  overflow-y: auto;
  max-block-size: 55vh;
}

.cal-subs__form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h4 {
    font-size: 0.9rem;
    font-weight: 700;
    margin: 0;
    color: var(--text, #ffffff);
  }
}

.cal-subs__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--grey-500, #888888);
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
  border: 1px solid var(--grey-300, #444444);
  border-radius: 8px;
  font-size: 0.875rem;
  outline: none;
  background: var(--grey-100, rgba(255,255,255,0.05));
  color: var(--text, #ffffff);
  transition: border-color 0.15s;

  &:focus { border-color: var(--primary, #1973ff); }
  &::placeholder { color: var(--grey-500, #666666); }
}

// ── Type buttons ──────────────────────────────

.cal-subs__type-btns {
  display: flex;
  gap: 0.35rem;
}

.cal-subs__type-btn {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--grey-300, #444444);
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--grey-500, #888888);
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
  flex-wrap: wrap;
}

.cal-subs__color-btn {
  inline-size: 1.4rem;
  block-size: 1.4rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;

  &:hover { transform: scale(1.15); }
  &.is-active {
    border-color: var(--text, #ffffff);
    transform: scale(1.15);
  }
}

// ── Info ──────────────────────────────────────

.cal-subs__info {
  font-size: 0.8rem;
  color: var(--grey-500, #888888);
  padding: 0.6rem 0.75rem;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  border-inline-start: 3px solid var(--primary, #1973ff);
  line-height: 1.5;

  a { color: var(--primary, #1973ff); }
  strong { color: var(--text, #ffffff); }
}

.cal-subs__security-info {
  font-size: 0.78rem;
  color: var(--grey-500, #888888);
  padding: 0.5rem 0.75rem;
  background: rgba(16,185,129,0.06);
  border-radius: 8px;
  border-inline-start: 3px solid #10b981;
  line-height: 1.5;
}

// ── Test result ───────────────────────────────

.cal-subs__test-result {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;

  &.is-success {
    background: rgba(16,185,129,0.15);
    color: #10b981;
  }
  &.is-error {
    background: rgba(229,62,62,0.15);
    color: #e53e3e;
  }
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
  border: 1px solid var(--grey-300, #444444);
  background: transparent;
  color: var(--text, #ffffff);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

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
