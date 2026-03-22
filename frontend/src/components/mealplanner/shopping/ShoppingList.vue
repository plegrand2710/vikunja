<template>
	<div class="shopping-list">
		<!-- Toolbar -->
		<div class="shopping-list__toolbar">
			<div class="shopping-list__info">
				<span class="shopping-list__count">
					{{ store.shoppingList.length }} article(s) à acheter
				</span>
				<span
					v-if="checkedCount > 0"
					class="shopping-list__checked-count"
				>
					· {{ checkedCount }} coché(s)
				</span>
			</div>

			<div class="shopping-list__actions">
				<button
					class="shopping-list__btn"
					:disabled="store.shoppingList.length === 0"
					@click="copyToClipboard"
				>
					📋 Copier
				</button>
				<button
					class="shopping-list__btn shopping-list__btn--primary"
					:disabled="store.shoppingList.length === 0 || vikunjaApi.isLoading.value"
					@click="handleCreateVikunjaTask"
				>
					📌 Tâche Vikunja
				</button>
			</div>
		</div>

		<!-- Message succès copie -->
		<Transition name="fade">
			<div
				v-if="copySuccess"
				class="shopping-list__success"
			>
				✅ Liste copiée dans le presse-papiers !
			</div>
		</Transition>

		<!-- Message succès Vikunja -->
		<Transition name="fade">
			<div
				v-if="vikunjaSuccess"
				class="shopping-list__success"
			>
				✅ Tâche créée dans Vikunja (projet 🍽️ FridgeFlow) !
			</div>
		</Transition>

		<!-- Liste vide -->
		<div
			v-if="store.shoppingList.length === 0"
			class="shopping-list__empty"
		>
			<span>🛒</span>
			<p>Votre liste de courses est vide.</p>
			<p class="shopping-list__empty-hint">
				Planifiez des repas dans le planning pour générer automatiquement votre liste.
			</p>
			<button
				class="shopping-list__btn shopping-list__btn--primary"
				@click="store.setActiveSection('planning')"
			>
				📅 Aller au planning
			</button>
		</div>

		<!-- Liste groupée par rayon -->
		<template v-else>
			<!-- Actions en masse -->
			<div class="shopping-list__bulk-actions">
				<button
					class="shopping-list__link"
					@click="checkAll"
				>
					Tout cocher
				</button>
				<span class="shopping-list__separator">·</span>
				<button
					class="shopping-list__link"
					@click="uncheckAll"
				>
					Tout décocher
				</button>
				<span
					v-if="checkedCount > 0"
					class="shopping-list__separator"
				>·</span>
				<button
					v-if="checkedCount > 0"
					class="shopping-list__link shopping-list__link--success"
					@click="importCheckedToInventory"
				>
					✅ Importer {{ checkedCount }} article(s) dans l'inventaire
				</button>
			</div>

			<!-- Groupes par catégorie -->
			<div class="shopping-list__groups">
				<div
					v-for="(items, category) in groupedList"
					:key="category"
					class="shopping-list__group"
				>
					<!-- En-tête du groupe -->
					<div class="shopping-list__group-header">
						<span class="shopping-list__group-icon">
							{{ categoryEmoji[category] ?? '🛒' }}
						</span>
						<span class="shopping-list__group-name">
							{{ category.charAt(0).toUpperCase() + category.slice(1) }}
						</span>
						<span class="shopping-list__group-count">
							{{ items.length }}
						</span>
					</div>

					<!-- Items -->
					<div class="shopping-list__items">
						<div
							v-for="item in items"
							:key="item.name"
							class="shopping-list__item"
							:class="{ 'is-checked': checkedItems.has(item.name) }"
							@click="toggleItem(item.name)"
						>
							<!-- Checkbox -->
							<div class="shopping-list__checkbox">
								<span v-if="checkedItems.has(item.name)">✓</span>
							</div>

							<!-- Nom -->
							<span class="shopping-list__item-name">{{ item.name }}</span>

							<!-- Quantités -->
							<div class="shopping-list__item-qty">
								<span class="shopping-list__item-tobuy">
									{{ item.toBuy }} {{ item.unit }}
								</span>
								<span
									v-if="item.inStock > 0"
									class="shopping-list__item-stock"
								>
									({{ item.inStock }} en stock)
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useMealPlannerStore } from '@/stores/mealplanner'
import { useVikunjaApi } from '@/composables/useVikunjaApi'

const store = useMealPlannerStore()
const vikunjaApi = useVikunjaApi()

// ── État local ────────────────────────────────

const checkedItems = ref<Set<string>>(new Set())
const copySuccess = ref(false)
const vikunjaSuccess = ref(false)

// ── Computed ──────────────────────────────────

const checkedCount = computed(() => checkedItems.value.size)

const categoryEmoji: Record<string, string> = {
	'légume': '🥦',
	'fruit': '🍎',
	'viande': '🥩',
	'poisson': '🐟',
	'féculent': '🍞',
	'produit laitier': '🧀',
	'épice': '🧂',
	'autre': '🛒',
}

// Groupe les items par catégorie
const groupedList = computed(() => {
	const groups: Record<string, typeof store.shoppingList> = {}
	for (const item of store.shoppingList) {
		if (!groups[item.category]) groups[item.category] = []
		groups[item.category].push(item)
	}
	return groups
})

// ── Actions ───────────────────────────────────

function toggleItem(name: string) {
	if (checkedItems.value.has(name)) {
		checkedItems.value.delete(name)
	} else {
		checkedItems.value.add(name)
	}
	// Forcer la réactivité de Set
	checkedItems.value = new Set(checkedItems.value)
}

function checkAll() {
	checkedItems.value = new Set(store.shoppingList.map(i => i.name))
}

function uncheckAll() {
	checkedItems.value = new Set()
}

/** Importe les items cochés dans l'inventaire */
function importCheckedToInventory() {
	const itemsToImport = store.shoppingList.filter(i =>
		checkedItems.value.has(i.name),
	)

	for (const item of itemsToImport) {
		store.addInventoryItem({
			name: item.name,
			qty: item.toBuy,
			unit: item.unit,
			category: item.category,
			location: 'fridge',
			expiry: null,
		})
	}

	// Décocher les items importés
	uncheckAll()
}

/** Copie la liste en texte formaté */
async function copyToClipboard() {
	const lines: string[] = ['🛒 Liste de courses\n']

	for (const [category, items] of Object.entries(groupedList.value)) {
		const emoji = categoryEmoji[category] ?? '🛒'
		lines.push(`${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`)
		for (const item of items) {
			lines.push(`  • ${item.name} — ${item.toBuy} ${item.unit}`)
		}
		lines.push('')
	}

	try {
		await navigator.clipboard.writeText(lines.join('\n'))
		copySuccess.value = true
		setTimeout(() => { copySuccess.value = false }, 3000)
	} catch {
		// Fallback si clipboard API non disponible
		const text = lines.join('\n')
		const el = document.createElement('textarea')
		el.value = text
		document.body.appendChild(el)
		el.select()
		document.execCommand('copy')
		document.body.removeChild(el)
		copySuccess.value = true
		setTimeout(() => { copySuccess.value = false }, 3000)
	}
}

/** Crée une tâche Vikunja avec la liste de courses */
async function handleCreateVikunjaTask() {
	const task = await vikunjaApi.createShoppingListTask(
		store.shoppingList.map(item => ({
			name: item.name,
			toBuy: item.toBuy,
			unit: item.unit,
			category: item.category,
		})),
	)

	if (task) {
		vikunjaSuccess.value = true
		setTimeout(() => { vikunjaSuccess.value = false }, 4000)
	}
}
</script>

<style lang="scss" scoped>
.shopping-list {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	max-inline-size: 700px;
}

// ── Toolbar ───────────────────────────────────

.shopping-list__toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
}

.shopping-list__info {
	font-size: 0.875rem;
	color: var(--grey-600, #666666);
}

.shopping-list__count {
	font-weight: 600;
	color: var(--text, #333333);
}

.shopping-list__checked-count {
	color: var(--success, #10b981);
}

.shopping-list__actions {
	display: flex;
	gap: 0.5rem;
}

.shopping-list__btn {
	padding: 0.45rem 0.9rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: white;
	font-size: 0.85rem;
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

// ── Messages ──────────────────────────────────

.shopping-list__success {
	padding: 0.6rem 1rem;
	background: #d1fae5;
	color: #065f46;
	border-radius: 8px;
	font-size: 0.875rem;
	font-weight: 500;
}

// ── Empty ─────────────────────────────────────

.shopping-list__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	padding: 3rem;
	border: 2px dashed var(--grey-200, #e8e8e8);
	border-radius: 12px;
	text-align: center;

	span { font-size: 3rem; }

	p {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text, #333333);
		margin: 0;
	}
}

.shopping-list__empty-hint {
	color: var(--grey-500, #888888) !important;
	font-size: 0.82rem !important;
	font-weight: 400 !important;
}

// ── Actions en masse ──────────────────────────

.shopping-list__bulk-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.82rem;
}

.shopping-list__link {
	background: none;
	border: none;
	color: var(--primary, #1973ff);
	cursor: pointer;
	font-size: 0.82rem;
	padding: 0;
	text-decoration: underline;

	&--success { color: var(--success, #10b981); }
}

.shopping-list__separator {
	color: var(--grey-300, #dddddd);
}

// ── Groupes ───────────────────────────────────

.shopping-list__groups {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.shopping-list__group {
	background: white;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	overflow: hidden;
}

.shopping-list__group-header {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	padding: 0.65rem 1rem;
	background: var(--grey-50, #fafafa);
	border-block-end: 1px solid var(--grey-200, #e8e8e8);
}

.shopping-list__group-icon {
	font-size: 1rem;
}

.shopping-list__group-name {
	font-size: 0.875rem;
	font-weight: 700;
	color: var(--text, #333333);
	flex: 1;
}

.shopping-list__group-count {
	font-size: 0.72rem;
	background: var(--grey-200, #e8e8e8);
	color: var(--grey-600, #666666);
	padding: 0.1rem 0.4rem;
	border-radius: 999px;
	font-weight: 600;
}

// ── Items ─────────────────────────────────────

.shopping-list__items {
	display: flex;
	flex-direction: column;
}

.shopping-list__item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.6rem 1rem;
	cursor: pointer;
	transition: background 0.15s;
	border-block-end: 1px solid var(--grey-100, #f5f5f5);

	&:last-child { border-block-end: none; }

	&:hover { background: var(--grey-50, #fafafa); }

	&.is-checked {
		opacity: 0.5;

		.shopping-list__item-name {
			text-decoration: line-through;
			color: var(--grey-400, #bbbbbb);
		}

		.shopping-list__checkbox {
			background: var(--success, #10b981);
			border-color: var(--success, #10b981);
			color: white;
		}
	}
}

.shopping-list__checkbox {
	inline-size: 1.25rem;
	block-size: 1.25rem;
	border: 2px solid var(--grey-300, #dddddd);
	border-radius: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.75rem;
	flex-shrink: 0;
	transition: background 0.15s, border-color 0.15s;
}

.shopping-list__item-name {
	flex: 1;
	font-size: 0.875rem;
	color: var(--text, #333333);
	transition: color 0.15s;
}

.shopping-list__item-qty {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	text-align: end;
}

.shopping-list__item-tobuy {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--primary, #1973ff);
}

.shopping-list__item-stock {
	font-size: 0.72rem;
	color: var(--grey-400, #bbbbbb);
}

// ── Transition ────────────────────────────────

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>