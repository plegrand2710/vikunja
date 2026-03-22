# feat: abonnements calendrier partagés

## Objectif

Remplacer les abonnements calendrier per-user (stockés dans frontendSettings) par des abonnements **partagés** stockés côté backend, visibles par tous les utilisateurs. Les credentials sont chiffrés en base. Le fetch des événements est fait par le serveur (les credentials ne sortent jamais du navigateur). Chaque utilisateur garde un état activé/désactivé per-subscription dans ses frontendSettings.

## Types supportés

- `ics` — URL ICS publique ou privée
- `caldav` — serveur CalDAV avec URL + username + password (Basic auth)
- `apple` — identique à caldav, pré-configuré sur `https://caldav.icloud.com/`

## Architecture

### Chiffrement des credentials

- Clé dérivée du `ServiceJWTSecret` via HKDF-SHA256 → 32 bytes
- Chiffrement AES-256-GCM
- Stockage en colonne BLOB (`username_enc`, `password_enc`)
- Le serveur déchiffre à la demande pour fetch les événements
- L'API ne retourne jamais username/password en clair

### Backend — fichiers à créer

1. `pkg/utils/encryption.go` — Encrypt(key, plaintext) / Decrypt(key, ciphertext) AES-256-GCM
2. `pkg/migration/20260322000001.go` — table `calendar_subscriptions`
3. `pkg/models/calendar_subscription.go` — model + CRUD (ReadAll, Create, Update, Delete)
4. `pkg/models/calendar_subscription_permissions.go` — tout utilisateur authentifié peut tout faire
5. `pkg/routes/api/v1/calendar_subscriptions.go` — handler GetCalendarSubscriptionEvents (fetch serveur)

### Backend — fichiers à modifier

- `pkg/routes/routes.go` — enregistrer les routes CRUD + events

### Table `calendar_subscriptions`

| Colonne        | Type               | Notes                        |
|----------------|--------------------|------------------------------|
| id             | BIGINT PK autoincr |                              |
| name           | VARCHAR(250)       |                              |
| type           | VARCHAR(50)        | ics / caldav / apple         |
| color          | VARCHAR(7)         | hex couleur                  |
| url            | TEXT               | URL CalDAV ou ICS            |
| username_enc   | BLOB               | username chiffré (nullable)  |
| password_enc   | BLOB               | password chiffré (nullable)  |
| created        | DATETIME           | auto                         |
| updated        | DATETIME           | auto                         |
| created_by_id  | BIGINT             | user qui a créé              |

### Routes API

```
GET    /api/v1/calendar-subscriptions              → liste (sans credentials)
PUT    /api/v1/calendar-subscriptions              → créer
POST   /api/v1/calendar-subscriptions/:id          → modifier
DELETE /api/v1/calendar-subscriptions/:id          → supprimer
GET    /api/v1/calendar-subscriptions/:id/events   → fetch événements (serveur-side)
```

### Frontend — fichiers à créer

1. `src/modelTypes/ICalendarSubscription.ts` — interface TypeScript
2. `src/services/calendarSubscription.ts` — service CRUD + events

### Frontend — fichiers à modifier

1. `src/stores/calendar.ts`
   - Supprimer tout le CRUD subscription (addSubscription, updateSubscription, deleteSubscription, etc.)
   - Garder `subscriptionEvents`, `setSubscriptionEvents`, `isSubscriptionModalOpen`, `editingSubscription`
   - Supprimer le type `CalendarSubscription` et `SubscriptionType` (déplacé vers modelTypes)

2. `src/composables/useSubscriptions.ts`
   - Réécrire entièrement pour utiliser le backend API
   - `fetchAllSubscriptions()` → appelle `GET /api/v1/calendar-subscriptions/:id/events` pour chaque sub enabled
   - Supprimer toute la logique client-side ICS/CalDAV (tsdav, fetch direct)

3. `src/composables/useVikunjaSettings.ts`
   - Supprimer la section `calendarSubscriptions` du load/save
   - Ajouter le load/save de `disabledCalendarSubscriptions: number[]` (IDs désactivés par user)

4. `src/composables/useCalendarSources.ts`
   - `loadAllSources()` : charger la liste depuis l'API, puis fetcher events pour ceux non-désactivés

5. `src/components/calendar/CalendarSubscriptions.vue`
   - Brancher sur le nouveau service
   - Supprimer Google OAuth, Vdirsyncer config
   - Lors de l'édition, afficher `***` pour password (ne pas re-envoyer si inchangé)
   - Le toggle activé/désactivé modifie `disabledCalendarSubscriptions` dans frontendSettings

## État activé/désactivé per-user

```json
// dans frontendSettings de chaque utilisateur
{
  "disabledCalendarSubscriptions": [3, 7]
}
```

- Par défaut (ID absent) = activé
- Toggle = ajoute/retire l'ID de la liste
- Persisté via `authStore.saveUserSettings()`

## Sécurité

- Credentials jamais en transit client → serveur sauf à la création/modification
- Credentials jamais en transit serveur → client
- AES-256-GCM avec nonce aléatoire par chiffrement
- Clé dérivée du JWT secret (géré par agenix sur NixOS)
- Fetch CalDAV/ICS fait par le serveur uniquement

## Ordre d'implémentation

1. Backend : encryption util
2. Backend : migration
3. Backend : model + permissions
4. Backend : routes handler events
5. Backend : routes.go
6. Frontend : modelType + service
7. Frontend : store (nettoyage)
8. Frontend : useVikunjaSettings
9. Frontend : useSubscriptions (réécriture)
10. Frontend : useCalendarSources
11. Frontend : CalendarSubscriptions.vue
