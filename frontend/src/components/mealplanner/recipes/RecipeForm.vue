<template>
	<Teleport to="body">
		<Transition name="modal">
			<div
				v-if="isOpen"
				class="recipe-form"
			>
				<div
					class="recipe-form__overlay"
					@click="emit('close')"
				/>

				<div class="recipe-form__modal">
					<!-- Header -->
					<div class="recipe-form__header">
						<h2>{{ isEditing ? 'Modifier la recette' : 'Ajouter une recette' }}</h2>
						<button
							class="recipe-form__close"
							@click="emit('close')"
						>
							✕
						</button>
					</div>

					<!-- Génération Claude -->
					<div
						v-if="!isEditing"
						class="recipe-form__claude-section"
					>
						<p class="recipe-form__claude-hint">
							🤖 Laissez Claude générer la fiche à partir d'une description
						</p>
						<div class="recipe-form__claude-row">
							<input
								v-model="claudeDescription"
								type="text"
								placeholder="ex: Gratin de courgettes végétarien léger..."
								class="recipe-form__input"
								@keydown.enter="handleClaudeGenerate"
							>
							<button
								class="recipe-form__btn recipe-form__btn--claude"
								:disabled="!claudeDescription.trim() || store.isLoading"
								@click="handleClaudeGenerate"
							>
								Générer
							</button>
						</div>
						<div class="recipe-form__divider">
							<span>ou remplissez manuellement</span>
						</div>
					</div>

					<!-- Formulaire -->
					<div class="recipe-form__body">
						<!-- Nom -->
						<div class="recipe-form__field">
							<label class="recipe-form__label">Nom *</label>
							<input
								v-model="form.name"
								type="text"
								placeholder="Nom de la recette"
								class="recipe-form__input"
							>
						</div>

						<!-- Type + Régime -->
						<div class="recipe-form__row">
							<div class="recipe-form__field">
								<label class="recipe-form__label">Repas</label>
								<select
									v-model="form.slot"
									class="recipe-form__select"
								>
									<option value="any">
										Indifférent
									</option>
									<option value="breakfast">
										Petit-déjeuner
									</option>
									<option value="lunch">
										Déjeuner
									</option>
									<option value="dinner">
										Dîner
									</option>
								</select>
							</div>
							<div class="recipe-form__field">
								<label class="recipe-form__label">Régime</label>
								<div class="recipe-form__diet-buttons">
									<button
										v-for="diet in DIETS"
										:key="diet.value"
										class="recipe-form__diet-btn"
										:class="{ 'is-active': form.diet === diet.value }"
										type="button"
										@click="form.diet = diet.value"
									>
										{{ diet.label }}
									</button>
								</div>
							</div>
						</div>

						<!-- Calories + temps + portions -->
						<div class="recipe-form__row recipe-form__row--4">
							<div class="recipe-form__field">
								<label class="recipe-form__label">Calories (kcal)</label>
								<input
									v-model.number="form.calories"
									type="number"
									min="0"
									class="recipe-form__input"
								>
							</div>
							<div class="recipe-form__field">
								<label class="recipe-form__label">Préparation (min)</label>
								<input
									v-model.number="form.prepTime"
									type="number"
									min="0"
									class="recipe-form__input"
								>
							</div>
							<div class="recipe-form__field">
								<label class="recipe-form__label">Cuisson (min)</label>
								<input
									v-model.number="form.cookTime"
									type="number"
									min="0"
									class="recipe-form__input"
								>
							</div>
							<div class="recipe-form__field">
								<label class="recipe-form__label">Portions</label>
								<input
									v-model.number="form.servings"
									type="number"
									min="1"
									class="recipe-form__input"
								>
							</div>
						</div>

						<!-- Note -->
						<div class="recipe-form__field">
							<label class="recipe-form__label">Note</label>
							<div class="recipe-form__stars">
								<button
									v-for="star in 5"
									:key="star"
									type="button"
									class="recipe-form__star"
									@click="form.rating = star as Recipe['rating']"
								>
									{{ star <= form.rating ? '⭐' : '☆' }}
								</button>
							</div>
						</div>

						<!-- Tags -->
						<div class="recipe-form__field">
							<label class="recipe-form__label">Tags</label>
							<div class="recipe-form__tags">
								<span
									v-for="tag in form.tags"
									:key="tag"
									class="recipe-form__tag"
								>
									{{ tag }}
									<button
										type="button"
										@click="removeTag(tag)"
									>
										✕
									</button>
								</span>
								<input
									v-model="newTag"
									type="text"
									placeholder="+ tag"
									class="recipe-form__tag-input"
									@keydown.enter.prevent="addTag"
									@keydown.comma.prevent="addTag"
								>
							</div>
						</div>

						<!-- Ingrédients -->
						<div class="recipe-form__field">
							<label class="recipe-form__label">Ingrédients</label>
							<div class="recipe-form__ingredients">
								<div
									v-for="(ing, i) in form.ingredients"
									:key="i"
									class="recipe-form__ingredient-row"
								>
									<input
										v-model="ing.name"
										type="text"
										placeholder="Ingrédient"
										class="recipe-form__input recipe-form__input--flex"
									>
									<input
										v-model.number="ing.qty"
										type="number"
										min="0"
										placeholder="Qté"
										class="recipe-form__input recipe-form__input--small"
									>
									<select
										v-model="ing.unit"
										class="recipe-form__select recipe-form__select--small"
									>
										<option
											v-for="u in UNITS"
											:key="u"
											:value="u"
										>
											{{ u }}
										</option>
									</select>
									<button
										type="button"
										class="recipe-form__remove-btn"
										@click="form.ingredients.splice(i, 1)"
									>
										✕
									</button>
								</div>
								<button
									type="button"
									class="recipe-form__add-row-btn"
									@click="addIngredient"
								>
									+ Ajouter un ingrédient
								</button>
							</div>
						</div>

						<!-- Étapes -->
						<div class="recipe-form__field">
							<label class="recipe-form__label">Étapes</label>
							<div class="recipe-form__steps">
								<div
									v-for="(step, i) in form.steps"
									:key="i"
									class="recipe-form__step-row"
								>
									<span class="recipe-form__step-num">{{ i + 1 }}</span>
									<textarea
										v-model="form.steps[i]"
										rows="2"
										class="recipe-form__textarea"
										:placeholder="`Étape ${i + 1}...`"
									/>
									<button
										type="button"
										class="recipe-form__remove-btn"
										@click="form.steps.splice(i, 1)"
									>
										✕
									</button>
								</div>
								<button
									type="button"
									class="recipe-form__add-row-btn"
									@click="form.steps.push('')"
								>
									+ Ajouter une étape
								</button>
							</div>
						</div>

						<!-- Notes perso -->
						<div class="recipe-form__field">
							<label class="recipe-form__label">Notes personnelles</label>
							<textarea
								v-model="form.notes"
								rows="2"
								placeholder="Conseils, variations..."
								class="recipe-form__textarea"
							/>
						</div>
					</div>

					<!-- Footer -->
					<div class="recipe-form__footer">
						<button
							class="recipe-form__btn"
							@click="emit('close')"
						>
							Annuler
						</button>
						<button
							class="recipe-form__btn recipe-form__btn--primary"
							:disabled="!form.name.trim()"
							@click="handleSave"
						>
							{{ isEditing ? 'Enregistrer' : 'Ajouter à la base' }}
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import type { Recipe, IngredientUnit } from '@/stores/mealplanner'
import { useMealPlannerStore } from '@/stores/mealplanner'
import { useClaude } from '@/composables/useClaude'

const props = defineProps<{
	isOpen: boolean
	editRecipe?: Recipe | null
}>()

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'saved', recipe: Recipe): void
}>()

const store = useMealPlannerStore()
const claude = useClaude()

const isEditing = ref(false)
const claudeDescription = ref('')
const newTag = ref('')

const UNITS: IngredientUnit[] = ['g', 'kg', 'ml', 'l', 'pièce', 'cs', 'cc']
const DIETS = [
	{ value: 'vegan' as const, label: '🥦 Vegan' },
	{ value: 'fish' as const, label: '🐟 Poisson' },
	{ value: 'all' as const, label: '🍽️ Tout' },
]

// Formulaire réactif
const form = reactive<{
	name: string
	slot: Recipe['slot']
	diet: Recipe['diet']
	calories: number
	prepTime: number
	cookTime: number
	servings: number
	rating: Recipe['rating']
	tags: string[]
	ingredients: { name: string; qty: number; unit: IngredientUnit; category: string }[]
	steps: string[]
	notes: string
}>({
	name: '',
	slot: 'any',
	diet: 'all',
	calories: 400,
	prepTime: 15,
	cookTime: 20,
	servings: 2,
	rating: 3,
	tags: [],
	ingredients: [],
	steps: [],
	notes: '',
})

// Quand on ouvre en mode édition, pré-remplir le formulaire
watch(() => props.isOpen, (open) => {
	if (open && props.editRecipe) {
		isEditing.value = true
		Object.assign(form, {
			name: props.editRecipe.name,
			slot: props.editRecipe.slot,
			diet: props.editRecipe.diet,
			calories: props.editRecipe.calories,
			prepTime: props.editRecipe.prepTime,
			cookTime: props.editRecipe.cookTime,
			servings: props.editRecipe.servings,
			rating: props.editRecipe.rating,
			tags: [...props.editRecipe.tags],
			ingredients: props.editRecipe.ingredients.map(i => ({ ...i })),
			steps: [...props.editRecipe.steps],
			notes: props.editRecipe.notes,
		})
	} else if (open) {
		isEditing.value = false
		resetForm()
	}
})

function resetForm() {
	form.name = ''
	form.slot = 'any'
	form.diet = 'all'
	form.calories = 400
	form.prepTime = 15
	form.cookTime = 20
	form.servings = 2
	form.rating = 3
	form.tags = []
	form.ingredients = []
	form.steps = []
	form.notes = ''
	claudeDescription.value = ''
}

function addTag() {
	const tag = newTag.value.trim()
	if (tag && !form.tags.includes(tag)) {
		form.tags.push(tag)
	}
	newTag.value = ''
}

function removeTag(tag: string) {
	form.tags = form.tags.filter(t => t !== tag)
}

function addIngredient() {
	form.ingredients.push({ name: '', qty: 100, unit: 'g', category: 'autre' })
}

async function handleClaudeGenerate() {
	if (!claudeDescription.value.trim()) return
	const recipe = await claude.generateRecipeFromDescription({
		description: claudeDescription.value,
	})
	if (recipe) {
		Object.assign(form, {
			name: recipe.name,
			slot: recipe.slot,
			diet: recipe.diet,
			calories: recipe.calories,
			prepTime: recipe.prepTime,
			cookTime: recipe.cookTime,
			servings: recipe.servings,
			rating: recipe.rating,
			tags: [...recipe.tags],
			ingredients: recipe.ingredients.map(i => ({ ...i })),
			steps: [...recipe.steps],
			notes: recipe.notes,
		})
	}
}

function handleSave() {
	if (!form.name.trim()) return

	let saved: Recipe

	if (isEditing.value && props.editRecipe) {
		store.updateRecipe(props.editRecipe.id, {
			name: form.name,
			slot: form.slot,
			diet: form.diet,
			calories: form.calories,
			prepTime: form.prepTime,
			cookTime: form.cookTime,
			servings: form.servings,
			rating: form.rating,
			tags: form.tags,
			ingredients: form.ingredients,
			steps: form.steps.filter(s => s.trim()),
			notes: form.notes,
		})
		saved = { ...props.editRecipe, ...form }
	} else {
		saved = store.addRecipe({
			name: form.name,
			slot: form.slot,
			diet: form.diet,
			calories: form.calories,
			prepTime: form.prepTime,
			cookTime: form.cookTime,
			servings: form.servings,
			rating: form.rating,
			tags: form.tags,
			ingredients: form.ingredients,
			steps: form.steps.filter(s => s.trim()),
			notes: form.notes,
			origin: 'manual',
		})
	}

	emit('saved', saved)
	emit('close')
}
</script>

<style lang="scss" scoped>
.recipe-form {
	position: fixed;
	inset: 0;
	z-index: 1100;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1rem;
}

.recipe-form__overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
}

.recipe-form__modal {
	position: relative;
	background: white;
	border-radius: 16px;
	inline-size: min(680px, 100%);
	max-block-size: 90vh;
	display: flex;
	flex-direction: column;
	box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
	overflow: hidden;
}

// ── Header ────────────────────────────────────

.recipe-form__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1.25rem 1.5rem 1rem;
	border-block-end: 1px solid var(--grey-200, #e8e8e8);
	flex-shrink: 0;

	h2 {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text, #333333);
		margin: 0;
	}
}

.recipe-form__close {
	background: none;
	border: none;
	font-size: 1rem;
	cursor: pointer;
	padding: 0.25rem 0.5rem;
	border-radius: 6px;
	color: var(--grey-500, #888888);

	&:hover { background: var(--grey-100, #f5f5f5); }
}

// ── Claude section ────────────────────────────

.recipe-form__claude-section {
	padding: 1rem 1.5rem;
	background: #faf5ff;
	border-block-end: 1px solid #e9d5ff;
	flex-shrink: 0;
}

.recipe-form__claude-hint {
	font-size: 0.82rem;
	color: #7c3aed;
	margin: 0 0 0.6rem;
	font-weight: 500;
}

.recipe-form__claude-row {
	display: flex;
	gap: 0.5rem;
}

.recipe-form__divider {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-block-start: 0.75rem;
	color: var(--grey-400, #bbbbbb);
	font-size: 0.78rem;

	&::before,
	&::after {
		content: '';
		flex: 1;
		block-size: 1px;
		background: #e9d5ff;
	}
}

// ── Body ──────────────────────────────────────

.recipe-form__body {
	flex: 1;
	overflow-y: auto;
	padding: 1.25rem 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.recipe-form__field {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
}

.recipe-form__label {
	font-size: 0.8rem;
	font-weight: 600;
	color: var(--grey-600, #666666);
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.recipe-form__row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.75rem;

	&--4 {
		grid-template-columns: repeat(4, 1fr);
	}
}

.recipe-form__input {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	transition: border-color 0.15s;
	inline-size: 100%;
	box-sizing: border-box;

	&:focus { border-color: var(--primary, #1973ff); }

	&--flex { flex: 1; inline-size: auto; }
	&--small { inline-size: 70px; }
}

.recipe-form__select {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	background: white;

	&--small { inline-size: 70px; padding: 0.5rem 0.3rem; }
}

.recipe-form__textarea {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	font-size: 0.875rem;
	outline: none;
	resize: vertical;
	font-family: inherit;
	inline-size: 100%;
	box-sizing: border-box;

	&:focus { border-color: var(--primary, #1973ff); }
}

// ── Régime ────────────────────────────────────

.recipe-form__diet-buttons {
	display: flex;
	gap: 0.4rem;
}

.recipe-form__diet-btn {
	padding: 0.4rem 0.75rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: transparent;
	cursor: pointer;
	font-size: 0.82rem;
	transition: background 0.15s;

	&:hover { background: var(--grey-100, #f5f5f5); }
	&.is-active {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);
	}
}

// ── Étoiles ───────────────────────────────────

.recipe-form__stars {
	display: flex;
	gap: 0.15rem;
}

.recipe-form__star {
	background: none;
	border: none;
	font-size: 1.2rem;
	cursor: pointer;
	padding: 0.1rem;
	transition: transform 0.1s;

	&:hover { transform: scale(1.2); }
}

// ── Tags ──────────────────────────────────────

.recipe-form__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35rem;
	align-items: center;
	padding: 0.4rem;
	border: 1px solid var(--grey-200, #e8e8e8);
	border-radius: 8px;
	min-block-size: 42px;

	&:focus-within { border-color: var(--primary, #1973ff); }
}

.recipe-form__tag {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	background: var(--grey-100, #f5f5f5);
	padding: 0.2rem 0.5rem;
	border-radius: 4px;
	font-size: 0.78rem;

	button {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.7rem;
		color: var(--grey-400, #bbbbbb);
		padding: 0;
		line-height: 1;

		&:hover { color: var(--danger, #e53e3e); }
	}
}

.recipe-form__tag-input {
	border: none;
	outline: none;
	font-size: 0.82rem;
	min-inline-size: 80px;
	background: transparent;
}

// ── Ingrédients + étapes ─────────────────────

.recipe-form__ingredients,
.recipe-form__steps {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
}

.recipe-form__ingredient-row,
.recipe-form__step-row {
	display: flex;
	align-items: center;
	gap: 0.4rem;
}

.recipe-form__step-num {
	font-size: 0.78rem;
	font-weight: 700;
	color: var(--primary, #1973ff);
	min-inline-size: 1.2rem;
	text-align: center;
}

.recipe-form__remove-btn {
	background: none;
	border: none;
	cursor: pointer;
	color: var(--grey-400, #bbbbbb);
	font-size: 0.8rem;
	padding: 0.2rem 0.35rem;
	border-radius: 4px;
	flex-shrink: 0;

	&:hover { color: var(--danger, #e53e3e); background: rgba(229, 62, 62, 0.08); }
}

.recipe-form__add-row-btn {
	background: none;
	border: 1px dashed var(--grey-300, #dddddd);
	border-radius: 6px;
	padding: 0.4rem 0.75rem;
	font-size: 0.8rem;
	color: var(--grey-500, #888888);
	cursor: pointer;
	transition: border-color 0.15s, color 0.15s;

	&:hover {
		border-color: var(--primary, #1973ff);
		color: var(--primary, #1973ff);
	}
}

// ── Footer ────────────────────────────────────

.recipe-form__footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	padding: 1rem 1.5rem;
	border-block-start: 1px solid var(--grey-200, #e8e8e8);
	flex-shrink: 0;
}

.recipe-form__btn {
	padding: 0.5rem 1rem;
	border-radius: 8px;
	border: 1px solid var(--grey-200, #e8e8e8);
	background: var(--white, #ffffff);
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s;

	&:hover:not(:disabled) { background: var(--grey-100, #f5f5f5); }

	&--primary {
		background: var(--primary, #1973ff);
		color: white;
		border-color: var(--primary, #1973ff);

		&:hover:not(:disabled) { background: var(--primary-dark, #1560d4); }
		&:disabled { opacity: 0.5; cursor: not-allowed; }
	}

	&--claude {
		background: #7c3aed;
		color: white;
		border-color: #7c3aed;
		white-space: nowrap;

		&:hover:not(:disabled) { background: #6d28d9; }
		&:disabled { opacity: 0.5; cursor: not-allowed; }
	}
}

// ── Transition ────────────────────────────────

.modal-enter-active,
.modal-leave-active {
	transition: opacity 0.2s ease;

	.recipe-form__modal {
		transition: transform 0.2s ease;
	}
}

.modal-enter-from,
.modal-leave-to {
	opacity: 0;

	.recipe-form__modal {
		transform: scale(0.96);
	}
}
</style>