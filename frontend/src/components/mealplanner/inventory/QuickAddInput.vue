<template>
	<div class="quick-add">
		<div class="quick-add__row">
			<input
				v-model="inputValue"
				type="text"
				:placeholder="placeholder"
				class="quick-add__input"
				@keydown.enter="handleAdd"
			>
			<button
				class="quick-add__btn"
				:disabled="!inputValue.trim()"
				@click="handleAdd"
			>
				Ajouter
			</button>
		</div>

		<!-- Prévisualisation du parsing -->
		<Transition name="preview">
			<div
				v-if="preview"
				class="quick-add__preview"
			>
				<span class="quick-add__preview-label">Sera ajouté :</span>
				<span class="quick-add__preview-value">
					{{ preview.qty }}{{ preview.unit }} · {{ preview.name }} · {{ preview.category }}
				</span>
			</div>
		</Transition>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import type { InventoryItem } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'

const props = defineProps<{
	location: 'fridge' | 'pantry'
	placeholder?: string
}>()

const emit = defineEmits<{
	(e: 'added', item: InventoryItem): void
}>()

const store = useMealPlannerStore()
const inputValue = ref('')

// Prévisualisation en temps réel du parsing
const preview = computed(() => {
	if (!inputValue.value.trim()) return null
	return store.parseQuickInput(inputValue.value)
})

function handleAdd() {
	if (!inputValue.value.trim()) return

	const parsed = store.parseQuickInput(inputValue.value)
	const item = store.addInventoryItem({
		name: parsed.name ?? inputValue.value,
		qty: parsed.qty ?? 1,
		unit: parsed.unit ?? 'pièce',
		category: parsed.category ?? 'autre',
		location: props.location,
		expiry: null,
	})

	emit('added', item)
	inputValue.value = ''
}
</script>

<style lang="scss" scoped>
.quick-add {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
}

.quick-add__row {
	display: flex;
	gap: 0.5rem;
}

.quick-add__input {
	flex: 1;
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	transition: border-color 0.15s;

	&:focus {
		border-color: var(--primary, #1973ff);
	}
}

.quick-add__btn {
	padding: 0.5rem 1rem;
	background: var(--primary, #1973ff);
	color: white;
	border: none;
	border-radius: 8px;
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s;

	&:hover:not(:disabled) {
		background: var(--primary-dark, #1560d4);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.quick-add__preview {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.78rem;
	padding: 0.3rem 0.6rem;
	background: var(--grey-50, #fafafa);
	border-radius: 6px;
	border: 1px solid var(--grey-100, #f0f0f0);
}

.quick-add__preview-label {
	color: var(--grey-400, #bbbbbb);
}

.quick-add__preview-value {
	color: var(--text, #333333);
	font-weight: 500;
}

.preview-enter-active,
.preview-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}

.preview-enter-from,
.preview-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}
</style>