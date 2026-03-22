<template>
	<div class="constraint-profiles">
		<h3 class="constraint-profiles__title">
			Profils
		</h3>

		<p class="constraint-profiles__hint">
			Sauvegardez vos contraintes actuelles sous un nom pour les réutiliser.
		</p>

		<!-- Profils sauvegardés -->
		<div
			v-if="store.constraints.profiles.length > 0"
			class="constraint-profiles__list"
		>
			<div
				v-for="profile in store.constraints.profiles"
				:key="profile.id"
				class="constraint-profiles__item"
			>
				<span class="constraint-profiles__item-name">{{ profile.name }}</span>
				<div class="constraint-profiles__item-actions">
					<button
						class="constraint-profiles__btn constraint-profiles__btn--load"
						@click="store.loadConstraintProfile(profile.id)"
					>
						Charger
					</button>
					<button
						class="constraint-profiles__btn constraint-profiles__btn--delete"
						@click="store.deleteConstraintProfile(profile.id)"
					>
						✕
					</button>
				</div>
			</div>
		</div>

		<p
			v-else
			class="constraint-profiles__empty"
		>
			Aucun profil sauvegardé.
		</p>

		<!-- Sauvegarder le profil courant -->
		<div class="constraint-profiles__save">
			<input
				v-model="newProfileName"
				type="text"
				placeholder="Nom du profil (ex: Semaine légère)"
				class="constraint-profiles__input"
				@keydown.enter="saveProfile"
			>
			<button
				class="constraint-profiles__btn constraint-profiles__btn--save"
				:disabled="!newProfileName.trim()"
				@click="saveProfile"
			>
				Sauvegarder
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useMealPlannerStore } from '@/stores/mealplanner'

const store = useMealPlannerStore()
const newProfileName = ref('')

function saveProfile() {
	if (!newProfileName.value.trim()) return
	store.saveConstraintProfile(newProfileName.value.trim())
	newProfileName.value = ''
}
</script>

<style lang="scss" scoped>
.constraint-profiles {
	background: var(--white, #ffffff);
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 12px;
	padding: 1.25rem;
}

.constraint-profiles__title {
	font-size: 1rem;
	font-weight: 700;
	color: var(--text, #333333);
	margin: 0 0 0.4rem;
}

.constraint-profiles__hint {
	font-size: 0.8rem;
	color: var(--grey-500, #888888);
	margin: 0 0 1rem;
}

.constraint-profiles__list {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	margin-block-end: 1rem;
}

.constraint-profiles__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.6rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	background: var(--grey-50, #fafafa);
}

.constraint-profiles__item-name {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--text, #333333);
}

.constraint-profiles__item-actions {
	display: flex;
	gap: 0.4rem;
}

.constraint-profiles__empty {
	font-size: 0.8rem;
	color: var(--grey-400, #bbbbbb);
	margin: 0 0 1rem;
	font-style: italic;
}

.constraint-profiles__save {
	display: flex;
	gap: 0.5rem;
}

.constraint-profiles__input {
	flex: 1;
	padding: 0.45rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	transition: border-color 0.15s;

	&:focus {
		border-color: var(--primary, #1973ff);
	}
}

.constraint-profiles__btn {
	padding: 0.4rem 0.75rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: var(--white, #ffffff);
	font-size: 0.8rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;
	white-space: nowrap;

	&--load {
		color: var(--primary, #1973ff);
		border-color: var(--primary, #1973ff);

		&:hover {
			background: var(--primary-light, #e8f0ff);
		}
	}

	&--delete {
		color: var(--grey-400, #bbbbbb);

		&:hover {
			color: var(--danger, #e53e3e);
			border-color: var(--danger, #e53e3e);
		}
	}

	&--save {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover:not(:disabled) {
			background: var(--primary-dark, #1560d4);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
}
</style>