<template>
	<div class="sync-status">
		<!-- Configuration CalDAV manquante -->
		<div
			v-if="!store.isCaldavConfigured"
			class="sync-status__unconfigured"
		>
			<p>⚙️ CalDAV non configuré</p>
			<button
				class="sync-status__config-btn"
				@click="showConfig = true"
			>
				Configurer
			</button>
		</div>

		<!-- Panneau de configuration -->
		<Teleport to="body">
			<Transition name="modal">
				<div
					v-if="showConfig"
					class="sync-status__modal"
				>
					<div
						class="sync-status__overlay"
						@click="showConfig = false"
					/>
					<div class="sync-status__panel">
						<div class="sync-status__panel-header">
							<h3>Configuration CalDAV</h3>
							<button @click="showConfig = false">
								✕
							</button>
						</div>

						<div class="sync-status__panel-body">
							<div class="sync-status__field">
								<label>URL Radicale</label>
								<input
									v-model="configForm.url"
									type="text"
									placeholder="http://82.67.177.75:9090/radicale/pauline/"
									class="sync-status__input"
								>
							</div>
							<div class="sync-status__field">
								<label>Utilisateur</label>
								<input
									v-model="configForm.username"
									type="text"
									placeholder="pauline"
									class="sync-status__input"
								>
							</div>
							<div class="sync-status__field">
								<label>Mot de passe</label>
								<input
									v-model="configForm.password"
									type="password"
									placeholder="••••••••"
									class="sync-status__input"
								>
								<p class="sync-status__hint">
									Non persisté — redemandé à chaque session
								</p>
							</div>

							<!-- Test connexion -->
							<div
								v-if="testResult !== null"
								class="sync-status__test-result"
								:class="testResult ? 'is-success' : 'is-error'"
							>
								{{ testResult ? '✅ Connexion réussie' : '❌ Connexion échouée' }}
							</div>
						</div>

						<div class="sync-status__panel-footer">
							<button
								class="sync-status__btn"
								:disabled="isTestLoading"
								@click="handleTest"
							>
								{{ isTestLoading ? 'Test...' : 'Tester' }}
							</button>
							<button
								class="sync-status__btn sync-status__btn--primary"
								:disabled="!configForm.url || !configForm.username || !configForm.password"
								@click="handleSave"
							>
								Enregistrer
							</button>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useCalDAV } from '@/composables/useCalDAV'

const store = useCalendarStore()
const caldav = useCalDAV()

const showConfig = ref(false)
const testResult = ref<boolean | null>(null)
const isTestLoading = ref(false)

const configForm = reactive({
	url: store.caldavConfig.url,
	username: store.caldavConfig.username,
	password: '',
})

async function handleTest() {
	store.setCalDAVConfig({ ...configForm })
	isTestLoading.value = true
	testResult.value = await caldav.testConnection()
	isTestLoading.value = false
}

function handleSave() {
	store.setCalDAVConfig({ ...configForm })
	showConfig.value = false
	testResult.value = null
}
</script>

<style lang="scss" scoped>
.sync-status__unconfigured {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.5rem 0.75rem;
	background: var(--grey-50, #fafafa);
	border: 1px dashed var(--grey-300, #dddddd);
	border-radius: 8px;
	font-size: 0.82rem;
	color: var(--grey-600, #666666);
}

.sync-status__config-btn {
	padding: 0.3rem 0.65rem;
	border-radius: 6px;
	border: 1px solid var(--primary, #1973ff);
	background: white;
	color: var(--primary, #1973ff);
	font-size: 0.78rem;
	cursor: pointer;

	&:hover { background: var(--primary-light, #e8f0ff); }
}

// ── Modal ──────────────────────────────────────

.sync-status__modal {
	position: fixed;
	inset: 0;
	z-index: 2000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.sync-status__overlay {
	position: absolute;
	inset: 0;
	background: rgba(0,0,0,0.4);
}

.sync-status__panel {
	position: relative;
	background: white;
	border-radius: 16px;
	inline-size: min(480px, 90vw);
	box-shadow: 0 16px 48px rgba(0,0,0,0.2);
	overflow: hidden;
}

.sync-status__panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1.25rem 1.5rem 1rem;
	border-block-end: 1px solid var(--grey-200, #e8e8e8);

	h3 {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
		color: var(--text, #333333);
	}

	button {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		color: var(--grey-500, #888888);
		padding: 0.25rem 0.5rem;
		border-radius: 6px;

		&:hover { background: var(--grey-100, #f5f5f5); }
	}
}

.sync-status__panel-body {
	padding: 1.25rem 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
}

.sync-status__field {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;

	label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--grey-600, #666666);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
}

.sync-status__input {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	transition: border-color 0.15s;

	&:focus { border-color: var(--primary, #1973ff); }
}

.sync-status__hint {
	font-size: 0.72rem;
	color: var(--grey-400, #bbbbbb);
	margin: 0;
}

.sync-status__test-result {
	padding: 0.5rem 0.75rem;
	border-radius: 8px;
	font-size: 0.875rem;
	font-weight: 500;

	&.is-success { background: #d1fae5; color: #065f46; }
	&.is-error   { background: #fee2e2; color: #991b1b; }
}

.sync-status__panel-footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	padding: 1rem 1.5rem;
	border-block-start: 1px solid var(--grey-200, #e8e8e8);
}

.sync-status__btn {
	padding: 0.45rem 0.9rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;

	&:hover:not(:disabled) { background: var(--grey-100, #f5f5f5); }
	&:disabled { opacity: 0.5; cursor: not-allowed; }

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover:not(:disabled) { background: var(--primary-dark, #1560d4); }
	}
}

.modal-enter-active,
.modal-leave-active {
	transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
	opacity: 0;
}
</style>