/**
 * Composable useVikunjaApi
 * Interagit avec l'API REST de Vikunja pour intégrer FridgeFlow
 * dans l'écosystème Vikunja (projets, tâches, sous-tâches).
 *
 * UTILISATION PRINCIPALE :
 * - Créer une tâche "Courses du [date]" avec les items en sous-tâches
 * - Récupérer le token d'auth de la session Vikunja courante
 *
 * CONCEPT VUE : ce composable utilise window.API_URL qui est déjà
 * défini par Vikunja dans index.html — on réutilise la même base URL
 * que le reste de l'app, pas besoin de la reconfigurer.
 */

import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface VikunjaProject {
	id: number
	title: string
	description?: string
}

interface VikunjaTask {
	id: number
	title: string
	description?: string
	done: boolean
	due_date?: string        // ISO date
	project_id: number
	labels?: VikunjaLabel[]
}

interface VikunjaLabel {
	id: number
	title: string
	hex_color?: string
}

interface CreateTaskPayload {
	title: string
	description?: string
	due_date?: string
	project_id: number
}

interface ShoppingItem {
	name: string
	toBuy: number
	unit: string
	category: string
}

// ─────────────────────────────────────────────
// LE COMPOSABLE
// ─────────────────────────────────────────────

export function useVikunjaApi() {
	const authStore = useAuthStore()
	const isLoading = ref(false)
	const error = ref<string | null>(null)

	// ── HELPERS ───────────────────────────────

	/** Récupère le token JWT de la session Vikunja courante */
	function getAuthToken(): string {
		// Vikunja stocke le token dans le store auth Pinia
		// @ts-expect-error — token est dans le store mais pas typé publiquement
		const token = authStore.token ?? localStorage.getItem('token')
		if (!token) throw new Error('Non authentifié — connecte-toi à Vikunja d\'abord')
		return token
	}

	/** URL de base de l'API (définie par Vikunja dans window.API_URL) */
	function getApiUrl(): string {
		return window.API_URL.replace(/\/$/, '')
	}

	/** Wrapper fetch authentifié */
	async function apiFetch<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${getApiUrl()}${endpoint}`
		const token = getAuthToken()

		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`,
				...options.headers,
			},
		})

		if (!response.ok) {
			const err = await response.json().catch(() => ({}))
			throw new Error(`API Vikunja (${response.status}): ${err.message ?? JSON.stringify(err)}`)
		}

		return response.json() as Promise<T>
	}

	/** Wrapper qui gère le loading et les erreurs */
	async function withLoading<T>(fn: () => Promise<T>): Promise<T | null> {
		isLoading.value = true
		error.value = null
		try {
			return await fn()
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Erreur inconnue'
			console.error('[useVikunjaApi]', error.value)
			return null
		} finally {
			isLoading.value = false
		}
	}

	// ── PROJETS ───────────────────────────────

	/** Récupère tous les projets de l'utilisateur */
	async function getProjects(): Promise<VikunjaProject[]> {
		return withLoading(async () => {
			const projects = await apiFetch<VikunjaProject[]>('/projects')
			return projects ?? []
		}) as Promise<VikunjaProject[]>
	}

	/** Crée un projet FridgeFlow s'il n'existe pas encore */
	async function getOrCreateFridgeFlowProject(): Promise<VikunjaProject | null> {
		return withLoading(async () => {
			const projects = await apiFetch<VikunjaProject[]>('/projects')
			const existing = projects.find(p => p.title === '🍽️ FridgeFlow')
			if (existing) return existing

			return apiFetch<VikunjaProject>('/projects', {
				method: 'POST',
				body: JSON.stringify({
					title: '🍽️ FridgeFlow',
					description: 'Listes de courses générées automatiquement par FridgeFlow',
				}),
			})
		})
	}

	// ── TÂCHES ────────────────────────────────

	/** Crée une tâche dans un projet */
	async function createTask(payload: CreateTaskPayload): Promise<VikunjaTask | null> {
		return withLoading(() =>
			apiFetch<VikunjaTask>('/tasks', {
				method: 'PUT',
				body: JSON.stringify(payload),
			}),
		)
	}

	/**
	 * Crée une tâche "Courses du [date]" avec les items
	 * en description formatée.
	 *
	 * Note : Vikunja ne supporte pas les sous-tâches hiérarchiques
	 * via l'API publique de façon simple — on met les items
	 * en description markdown à la place, ce qui est plus lisible.
	 */
	async function createShoppingListTask(items: ShoppingItem[]): Promise<VikunjaTask | null> {
		return withLoading(async () => {
			// 1. Récupérer ou créer le projet FridgeFlow
			const project = await getOrCreateFridgeFlowProject()
			if (!project) throw new Error('Impossible de créer le projet FridgeFlow')

			// 2. Grouper les items par catégorie
			const grouped = items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
				const cat = item.category
				if (!acc[cat]) acc[cat] = []
				acc[cat].push(item)
				return acc
			}, {})

			// 3. Construire la description markdown
			const categoryEmojis: Record<string, string> = {
				'légume': '🥦',
				'fruit': '🍎',
				'viande': '🥩',
				'poisson': '🐟',
				'féculent': '🍞',
				'produit laitier': '🧀',
				'épice': '🧂',
				'autre': '🛒',
			}

			const description = Object.entries(grouped)
				.map(([category, categoryItems]) => {
					const emoji = categoryEmojis[category] ?? '🛒'
					const itemLines = categoryItems
						.map(i => `- [ ] ${i.name} — ${i.toBuy}${i.unit}`)
						.join('\n')
					return `## ${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n${itemLines}`
				})
				.join('\n\n')

			// 4. Titre avec la date
			const today = new Date()
			const dateStr = today.toLocaleDateString('fr-FR', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
			})
			const title = `🛒 Courses du ${dateStr}`

			// 5. Créer la tâche
			return apiFetch<VikunjaTask>('/tasks', {
				method: 'PUT',
				body: JSON.stringify({
					title,
					description,
					project_id: project.id,
					due_date: new Date(
						today.getTime() + 7 * 24 * 60 * 60 * 1000,
					).toISOString(), // dans 7 jours
				}),
			})
		})
	}

	/** Récupère les tâches d'un projet */
	async function getProjectTasks(projectId: number): Promise<VikunjaTask[]> {
		const result = await withLoading(() =>
			apiFetch<VikunjaTask[]>(`/projects/${projectId}/tasks`),
		)
		return result ?? []
	}

	/** Marque une tâche comme terminée */
	async function completeTask(taskId: number): Promise<VikunjaTask | null> {
		return withLoading(() =>
			apiFetch<VikunjaTask>(`/tasks/${taskId}`, {
				method: 'POST',
				body: JSON.stringify({ done: true }),
			}),
		)
	}

	return {
		// État
		isLoading,
		error,

		// Projets
		getProjects,
		getOrCreateFridgeFlowProject,

		// Tâches
		createTask,
		createShoppingListTask,
		getProjectTasks,
		completeTask,
	}
}