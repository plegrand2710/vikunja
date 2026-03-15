<template>
	<div
		class="inventory-item"
		:class="{ 'is-expiring': isExpiring }"
	>
		<!-- Mode lecture -->
		<template v-if="!editing">
			<span class="inventory-item__category">
				{{ categoryEmoji[item.category] ?? '📦' }}
			</span>

			<span class="inventory-item__name">{{ item.name }}</span>

			<span class="inventory-item__qty">
				{{ item.qty }} {{ item.unit }}
			</span>

			<span
				v-if="item.expiry"
				class="inventory-item__expiry"
				:class="{ 'is-soon': isExpiring }"
			>
				{{ isExpiring ? '⚠️' : '📅' }} {{ formatDate(item.expiry) }}
			</span>
			<span
				v-else
				class="inventory-item__expiry inventory-item__expiry--none"
			>
				—
			</span>

			<div class="inventory-item__actions">
				<button
					class="inventory-item__btn"
					title="Modifier"
					@click="startEdit"
				>
					✏️
				</button>
				<button
					class="inventory-item__btn inventory-item__btn--danger"
					title="Supprimer"
					@click="emit('remove', item.id)"
				>
					🗑️
				</button>
			</div>
		</template>

		<!-- Mode édition -->
		<template v-else>
			<span class="inventory-item__category">
				{{ categoryEmoji[editData.category] ?? '📦' }}
			</span>

			<input
				v-model="editData.name"
				class="inventory-item__edit-input"
				placeholder="Nom"
			/>

			<div class="inventory-item__qty-edit">
				<input
					v-model.number="editData.qty"
					type="number"
					min="0"
					class="inventory-item__edit-input inventory-item__edit-input--small"
				/>
				<select
					v-model="editData.unit"
					class="inventory-item__edit-select"
				>
					<option
						v-for="u in UNITS"
						:key="u"
						:value="u"
					>
						{{ u }}
					</option>
				</select>
			</div>

			<input
				v-model="editData.expiry"
				type="date"
				class="inventory-item__edit-input"
			/>

			<div class="inventory-item__actions">
				<button
					class="inventory-item__btn inventory-item__btn--save"
					@click="saveEdit"
				>
					✓
				</button>
				<button
					class="inventory-item__btn"
					@click="editing = false"
				>
					✕
				</button>
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, reactive } from 'vue'
import type { InventoryItem, IngredientUnit } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'

const props = defineProps<{
	item: InventoryItem
}>()

const emit = defineEmits<{
	(e: 'remove', id: string): void
}>()

const store = useMealPlannerStore()

const UNITS: IngredientUnit[] = ['g', 'kg', 'ml', 'l', 'pièce', 'cs', 'cc']

const categoryEmoji: Record<string, string> = {
	'légume': '🥦',
	'fruit': '🍎',
	'viande': '🥩',
	'poisson': '🐟',
	'féculent': '🍞',
	'produit laitier': '🧀',
	'épice': '🧂',
	'autre': '📦',
}

// Expiration dans moins de 3 jours
const isExpiring = computed(() => {
	if (!props.item.expiry) return false
	const threeDays = new Date()
	threeDays.setDate(threeDays.getDate() + 3)
	return new Date(props.item.expiry) <= threeDays
})

// ── Édition ───────────────────────────────────

const editing = ref(false)
const editData = reactive({
	name: '',
	qty: 0,
	unit: 'g' as IngredientUnit,
	expiry: '',
	category: props.item.category,
})

function startEdit() {
	editData.name = props.item.name
	editData.qty = props.item.qty
	editData.unit = props.item.unit
	editData.expiry = props.item.expiry ?? ''
	editData.category = props.item.category
	editing.value = true
}

function saveEdit() {
	store.updateInventoryItem(props.item.id, {
		name: editData.name,
		qty: editData.qty,
		unit: editData.unit,
		expiry: editData.expiry || null,
		category: editData.category,
	})
	editing.value = false
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'short',
	})
}
</script>

<style lang="scss" scoped>
.inventory-item {
	display: grid;
	grid-template-columns: 2rem 1fr 100px 110px 70px;
	align-items: center;
	gap: 0.75rem;
	padding: 0.6rem 0.75rem;
	border-radius: 8px;
	transition: background 0.15s;

	&:hover {
		background: var(--grey-50, #fafafa);
	}

	&.is-expiring {
		background: rgba(245, 158, 11, 0.06);
		border-left: 3px solid var(--warning, #f59e0b);
	}
}

.inventory-item__category {
	font-size: 1.1rem;
	text-align: center;
}

.inventory-item__name {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--text, #333);
}

.inventory-item__qty {
	font-size: 0.825rem;
	color: var(--grey-600, #666);
}

.inventory-item__expiry {
	font-size: 0.775rem;
	color: var(--grey-500, #888);

	&.is-soon {
		color: var(--warning, #d97706);
		font-weight: 600;
	}

	&--none {
		color: var(--grey-300, #ddd);
	}
}

.inventory-item__actions {
	display: flex;
	gap: 0.25rem;
	opacity: 0;
	transition: opacity 0.15s;

	.inventory-item:hover & {
		opacity: 1;
	}
}

.inventory-item__btn {
	background: none;
	border: none;
	cursor: pointer;
	padding: 0.2rem 0.35rem;
	border-radius: 5px;
	font-size: 0.8rem;
	transition: background 0.15s;

	&:hover {
		background: var(--grey-200, #e8e8e8);
	}

	&--danger:hover {
		background: rgba(229, 62, 62, 0.1);
	}

	&--save {
		color: var(--success, #10b981);
		font-weight: 700;
	}
}

// ── Mode édition ──────────────────────────────

.inventory-item__qty-edit {
	display: flex;
	gap: 0.25rem;
}

.inventory-item__edit-input {
	width: 100%;
	padding: 0.3rem 0.5rem;
	border: 1px solid var(--primary, #1973ff);
	border-radius: 6px;
	font-size: 0.8rem;
	outline: none;
	background: white;
	min-width: 0;

	&--small {
		width: 50px;
	}
}

.inventory-item__edit-select {
	padding: 0.3rem 0.4rem;
	border: 1px solid var(--primary, #1973ff);
	border-radius: 6px;
	font-size: 0.8rem;
	outline: none;
	background: white;
}
</style>