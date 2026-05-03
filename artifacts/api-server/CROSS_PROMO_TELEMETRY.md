# Cross-promo click telemetry

The `cross_promo_clicks` table records every click on a cross-promo link in
faultline-lab (footer grid, "Built by" footer link, and Debrief
cross-promo cards). Inserts happen via `POST /api/cross-promo/click` from
the frontend, fired non-blockingly so a failed event never prevents
navigation to the destination.

## Schema

`lib/db/src/schema/crossPromoClicks.ts` — table `cross_promo_clicks`:

| Column          | Type        | Notes                                                  |
| --------------- | ----------- | ------------------------------------------------------ |
| id              | text PK     | uuid                                                   |
| placement_id    | text        | e.g. `footer-grid-techdeck`, `debrief-automotive-techdeck` |
| target_product  | text        | short product slug (`techdeck`, `torqueshed`, ...)    |
| target_url      | text        | absolute href                                          |
| route           | text NULL   | `window.location.pathname + search` at click time      |
| user_tier       | text        | `anonymous` \| `free` \| `pro`                         |
| user_id         | text NULL   | internal users.id when signed in                       |
| clerk_id        | text NULL   | Clerk session userId when signed in                    |
| created_at      | timestamptz | defaults to now                                        |

Indexed on `(placement_id, created_at)` and `(target_product, created_at)`.

## Ad-hoc analysis

Open a psql shell against `DATABASE_URL` (use the database skill for the
production database).

Top placements over the last 7 days:

```sql
SELECT placement_id, COUNT(*) AS clicks
FROM cross_promo_clicks
WHERE created_at > now() - interval '7 days'
GROUP BY placement_id
ORDER BY clicks DESC;
```

Clicks per target product, split by user tier:

```sql
SELECT target_product, user_tier, COUNT(*) AS clicks
FROM cross_promo_clicks
WHERE created_at > now() - interval '30 days'
GROUP BY target_product, user_tier
ORDER BY target_product, clicks DESC;
```

Which routes drive the most ecosystem traffic:

```sql
SELECT route, COUNT(*) AS clicks
FROM cross_promo_clicks
WHERE created_at > now() - interval '30 days'
GROUP BY route
ORDER BY clicks DESC
LIMIT 20;
```

Recent activity stream:

```sql
SELECT created_at, placement_id, target_product, user_tier, route
FROM cross_promo_clicks
ORDER BY created_at DESC
LIMIT 50;
```

## Adding a new cross-promo placement

1. Render the link in faultline-lab and import `trackCrossPromoClick` from
   `@/lib/crossPromoTelemetry`.
2. Call it in the `onClick` handler with a stable, unique `placementId`
   (kebab-case, scoped by surface — e.g. `pricing-hero-techdeck`).
3. No backend change is required; the endpoint accepts any short string.
