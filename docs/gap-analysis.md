# ParasiteDB — Gap Analysis & Incremental Roadmap

Goal: make ParasiteDB a MongoDB-style free cloud database backed by Google Sheets,
with a familiar API so developers don't need to learn anything new.

---

## Current State Summary

| What exists | Status |
|---|---|
| Schema definition (name, type, required, primaryKey) | Partial |
| `createData()` — insert one document | Works |
| `find()` — basic single-match query | Works (limited) |
| `updateOne()` — update by query | Works |
| `deleteOne()` — delete by query | Works |
| Express REST demo server | Works |

---

## Gap Table — Feature by Feature

### 1. CRUD Operations

| MongoDB Method | ParasiteDB | Gap |
|---|---|---|
| `insertOne(doc)` | `createData(data)` — works | Rename to match MongoDB convention |
| `insertMany([docs])` | Missing | No bulk insert |
| `findOne(query)` | `find(query)` — returns first match | Rename; currently only exact match |
| `find(query)` | Missing | No multi-result return (always one row) |
| `findById(id)` | Missing | No ID-based lookup |
| `findOneAndUpdate(query, update)` | Missing | No atomic find + update |
| `updateOne(query, update)` | Works | No update operators ($set, $inc, etc.) |
| `updateMany(query, update)` | Missing | No bulk update |
| `replaceOne(query, doc)` | Missing | No full document replacement |
| `deleteOne(query)` | Works | Works |
| `deleteMany(query)` | Missing | No bulk delete |
| `countDocuments(query)` | Missing | No count query |
| `distinct(field, query)` | Missing | No distinct values |
| `exists(query)` | Missing | No existence check |

---

### 2. Query Operators

These are the `{ field: { $operator: value } }` patterns MongoDB is famous for.
**None of these exist in ParasiteDB today.**

| Operator | Meaning | Priority |
|---|---|---|
| `$eq` | Equal (default) | High |
| `$ne` | Not equal | High |
| `$gt` | Greater than | High |
| `$gte` | Greater than or equal | High |
| `$lt` | Less than | High |
| `$lte` | Less than or equal | High |
| `$in` | Value is in array | High |
| `$nin` | Value not in array | Medium |
| `$and` | All conditions match | High |
| `$or` | Any condition matches | High |
| `$not` | Negates a condition | Medium |
| `$nor` | None of conditions match | Low |
| `$exists` | Field exists | Medium |
| `$regex` | String matches regex | Medium |
| `$type` | Field is of this type | Low |

**Current limitation:** `find()` only supports exact equality matching using
Google Sheets FILTER formulas — no operators, no composition, no regex.

---

### 3. Update Operators

These are the `{ $operator: { field: value } }` patterns in `updateOne`.
**None of these exist in ParasiteDB today.**

| Operator | Meaning | Priority |
|---|---|---|
| `$set` | Set field to value | High |
| `$unset` | Remove a field | High |
| `$inc` | Increment a number | High |
| `$mul` | Multiply a number | Medium |
| `$min` | Set only if new value is lower | Low |
| `$max` | Set only if new value is higher | Low |
| `$rename` | Rename a field | Low |
| `$push` | Append to array field | Medium |
| `$pull` | Remove from array field | Medium |
| `$addToSet` | Add to array if not already present | Medium |
| `$pop` | Remove first/last element of array | Low |
| `$currentDate` | Set field to current date | Low |

**Current limitation:** `updateOne()` only does full-field replacement — pass `{ age: 26 }`
and it overwrites `age`. No operators, no atomic increments.

---

### 4. Schema & Validation

| Feature | Current State | Gap |
|---|---|---|
| Field name definition | Yes | |
| Data type (String, Integer) | Yes | Only 2 types (Boolean, Date, Array, Object missing) |
| Required field | Yes | |
| Primary key (uniqueness) | Yes (one per schema) | Cannot have compound unique keys |
| Default values | Missing | No `default:` option |
| Min / max (numbers) | Missing | No range validation |
| Min / max length (strings) | Missing | No length validation |
| Enum / allowed values | Missing | No `enum: [...]` option |
| Regex pattern | Missing | No pattern validation |
| Custom validator functions | Missing | No `validate: fn` option |
| Schema-less / flexible mode | Missing | Schema is always mandatory |
| Schema versioning / migration | Missing | No way to evolve a schema |

---

### 5. Data Types

| Type | Supported | Notes |
|---|---|---|
| String | Yes | |
| Integer | Yes | |
| Float / Number | No | No decimal support |
| Boolean | No | No true/false fields |
| Date / Timestamp | No | No date storage or comparison |
| Array | No | No list fields |
| Nested Object | No | No subdocuments |
| Null | No | Cannot store/check for null |

---

### 6. Pagination & Sorting

| Feature | Current State |
|---|---|
| `limit(n)` — max results to return | Missing |
| `skip(n)` — offset results | Missing |
| `sort({ field: 1 })` — ascending / descending | Missing |
| Cursor-based pagination | Missing |

---

### 7. Aggregation

| Feature | Current State |
|---|---|
| `$match` — filter | Missing |
| `$group` — group + reduce | Missing |
| `$sort` | Missing |
| `$limit` / `$skip` | Missing |
| `$project` — shape output fields | Missing |
| `$count` | Missing |
| `$sum`, `$avg`, `$min`, `$max` | Missing |

Aggregation is advanced — treat this as a future phase.

---

### 8. Performance & Reliability

| Issue | Current State |
|---|---|
| Google Sheets API rate limits (60 req/min/user, 300/min/project) | No handling — crashes on 429 errors |
| Retry logic on failures | Missing |
| Batching multiple writes into one API call | Missing — every operation is multiple calls |
| In-memory caching for reads | Missing — every read hits Google API |
| Concurrent operations (multiple requests at same time) | Broken — all use same "Query" sheet |

---

### 9. ID Generation

| Issue | Current State |
|---|---|
| ID format | MD5 hash % 99,999 → only ~100k unique IDs |
| Collision risk | ~50% chance of collision after ~315 documents |
| Standard | Should be UUID v4 or nanoid (billions of unique IDs) |

---

### 10. Developer Experience (DX)

| Feature | Current State |
|---|---|
| Published npm package | Not published |
| TypeScript type definitions | Missing |
| JSDoc / API documentation | Missing |
| Unit tests | None |
| Integration tests | None |
| `.env.example` file | Missing |
| Startup validation (are credentials valid?) | Missing — crashes with unclear errors |
| Proper error types/classes | Missing — throws raw `Error` strings |
| Connection events (`connected`, `error`, `disconnected`) | Missing |
| Multiple collections from same connection | Clunky — requires manual schema init |

---

## Incremental Roadmap

### Phase 1 — Foundation (make it reliable)
Fix the things that are broken or dangerous before adding features.

- [ ] Replace ID generation with UUID v4
- [ ] Add retry logic + exponential backoff for rate limit errors
- [ ] Fix concurrent operation safety (remove global Query sheet dependency)
- [ ] Add proper error classes (`ValidationError`, `DuplicateKeyError`, `ConnectionError`)
- [ ] Add startup credential validation
- [ ] Add `.env.example`

### Phase 2 — Core MongoDB API
Make the API feel like MongoDB.

- [ ] Rename methods: `createData` → `insertOne`, `find` → `findOne`
- [ ] Add `insertMany(docs)`
- [ ] Add `find(query)` returning all matching documents
- [ ] Add `findById(id)`
- [ ] Add `deleteMany(query)`
- [ ] Add `updateMany(query, update)`
- [ ] Add `countDocuments(query)`
- [ ] Implement update operators: `$set`, `$unset`, `$inc`

### Phase 3 — Query Operators
Make queries expressive.

- [ ] `$eq`, `$ne`
- [ ] `$gt`, `$gte`, `$lt`, `$lte`
- [ ] `$in`, `$nin`
- [ ] `$and`, `$or`
- [ ] `$exists`
- [ ] `$regex`

### Phase 4 — Data Types & Validation
Support richer data and better schema constraints.

- [ ] Float/Number type
- [ ] Boolean type
- [ ] Date type
- [ ] Default values
- [ ] Enum validation
- [ ] Min/max validation
- [ ] Custom validator functions

### Phase 5 — Pagination & Sorting
- [ ] `find().sort({ field: 1 })`
- [ ] `find().limit(n).skip(n)`

### Phase 6 — Performance
- [ ] In-memory read cache with TTL
- [ ] Batch writes using Google Sheets `batchUpdate`
- [ ] Preload sheet data to reduce per-operation API calls

### Phase 7 — DX & Packaging
- [ ] TypeScript definitions
- [ ] Publish to npm
- [ ] API documentation
- [ ] Unit + integration test suite
- [ ] Proper connection lifecycle (`connect()`, `disconnect()`, events)

### Phase 8 — Aggregation (advanced)
- [ ] `aggregate()` with `$match`, `$group`, `$sort`, `$limit`, `$project`
- [ ] `$sum`, `$avg`, `$min`, `$max` accumulators
