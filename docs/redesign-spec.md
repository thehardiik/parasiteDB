# ParasiteDB — Full Redesign Spec

Vision: a free, MongoDB-style cloud database where data lives in Google Sheets.
Zero hosting cost. Familiar API. Data visible and editable in a browser spreadsheet.

---

## The Target Developer Experience

```js
const { createClient } = require('parasitedb');

// Connect once
const client = await createClient({
  email: process.env.EMAIL,
  key:   process.env.KEY,
  sheetId: process.env.SHEETID,
});

const db = client.db('myapp');
const users = db.collection('users');

// Optional schema for validation
users.setSchema({
  name:  { type: 'String',  required: true },
  age:   { type: 'Integer' },
  email: { type: 'String',  required: true, unique: true },
});

// INSERT
await users.insertOne({ name: 'Alice', age: 25, email: 'alice@example.com' });
await users.insertMany([{ name: 'Bob', age: 30 }, { name: 'Carol', age: 22 }]);

// READ
const alice  = await users.findOne({ email: 'alice@example.com' });
const adults = await users.find({ age: { $gte: 18 } });
const paged  = await users.find({}).sort({ age: 1 }).limit(10).skip(0);
const byId   = await users.findById('uuid-string-here');

// UPDATE
await users.updateOne({ name: 'Alice' }, { $set: { age: 26 }, $inc: { loginCount: 1 } });
await users.updateMany({ age: { $lt: 18 } }, { $set: { isMinor: true } });

// DELETE
await users.deleteOne({ email: 'alice@example.com' });
await users.deleteMany({ age: { $lt: 13 } });

// UTILITY
const count = await users.countDocuments({ age: { $gte: 18 } });
```

Anyone who has used MongoDB can use this without reading docs.

---

## What Is Wrong With the Current Architecture

### Problem 1: Formula-Based Querying

**Current approach:** Every `find`, `update`, and `delete` works by writing a
Google Sheets FILTER formula into a "Query" sheet, waiting for Sheets to evaluate it,
then reading the result back.

**Why this is a problem:**
- Requires 3–5 API calls per operation (write formula → read result → clear cell → write data)
- Can only express what FILTER formulas can express — no `$gt`, `$or`, `$regex`
- Formula strings are built by concatenating user data → formula injection risk
- Formula errors from bad data silently return wrong results
- Extending it to support new operators means writing new formula templates

**Fix:** Pull the entire sheet into memory as a JS array once, run all
filtering/matching in JavaScript, write only the changed rows back. This is faster,
supports any query, and has no injection risk.

---

### Problem 2: Google Sheets API Rate Limits

**Current approach:** No awareness of rate limits. Every operation fires as many
API calls as it needs.

**Limits:**
- 60 requests per minute per user
- 300 requests per minute per project
- Exceeding this returns HTTP 429 — which currently crashes the app

**Why this is a problem:** Even moderate usage (10 users each making 6 requests/minute)
hits the per-user limit. The library will silently fail in production.

**Fix:**
- Detect 429 responses and retry with exponential backoff
- Batch multiple writes into a single `batchUpdate` call
- Cache reads so repeated `find` calls don't each hit the API

---

### Problem 3: Collision-Prone ID Generation

**Current approach:** `_id = MD5(primaryKeyValue) % 99999`

**Why this is a problem:**
- Only 99,999 possible IDs per collection
- The birthday paradox means a 50% collision chance after ~315 documents
- Collisions silently corrupt data (new document overwrites old one)

**Fix:** Use UUID v4 (122 bits of randomness — practically zero collision risk,
even at billions of documents).

---

### Problem 4: Global "Query" Sheet — No Concurrency

**Current approach:** All operations write to and read from the same single "Query"
sheet tab as scratch space.

**Why this is a problem:** If two requests arrive at the same time (even just 2
users simultaneously), they overwrite each other's formula in the Query sheet.
The results are silently wrong.

**Fix:** Eliminate formula-based operations entirely (see Problem 1 fix).
All query processing moves to JavaScript in memory — no shared scratch space needed.

---

### Problem 5: Schema Encoded in Column Headers

**Current approach:** Row 1 of each sheet stores column names with constraint
annotations like `caption:P:R:String` (primary key, required, string type).

**Why this is a problem:**
- Fragile string parsing — one typo breaks the schema
- No versioning — can't migrate a schema without data loss
- Hard to read by humans looking at the sheet
- Can't store complex validation rules (enums, patterns, defaults)

**Fix:** Store all schema definitions as JSON rows in a dedicated `__metadata`
sheet. Column headers in data sheets are clean field names only.
Schema lives separately and can be versioned.

---

### Problem 6: No Bulk Operations

**Current approach:** Each insert, update, or delete is a separate sequence of
API calls regardless of how many documents are affected.

**Why this is a problem:** Inserting 100 documents = 100+ API calls. Hits rate
limits immediately. Minutes of waiting.

**Fix:** Collect all changes during an operation and flush them to the Sheets API
in a single `batchUpdate` call.

---

## Proposed New Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Application                   │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│               ParasiteDB Client API                  │
│  createClient() → client.db() → db.collection()     │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│               Collection Layer                       │
│  insertOne / find / updateOne / deleteOne / ...      │
│  Validates against schema, generates _id             │
└──────────┬────────────────────┬──────────────────────┘
           │                    │
┌──────────▼────────┐  ┌────────▼──────────────────────┐
│   Query Engine    │  │     Write Buffer               │
│   (pure JS)       │  │  Batches changes before flush  │
│   filter / sort   │  └────────┬──────────────────────┘
│   project / count │           │
└──────────┬────────┘  ┌────────▼──────────────────────┐
           │           │   In-Memory Cache               │
└──────────┘           │   TTL-based per collection      │
                       └────────┬──────────────────────┘
                                │
                  ┌─────────────▼─────────────────────┐
                  │      Google Sheets Adapter          │
                  │  getRows / appendRows / batchUpdate │
                  │  Retry + exponential backoff        │
                  │  Rate limit queue                   │
                  └─────────────┬─────────────────────┘
                                │
                  ┌─────────────▼─────────────────────┐
                  │        Google Sheets API            │
                  │   (the actual free cloud storage)   │
                  └───────────────────────────────────┘
```

---

## Layer Descriptions

### Query Engine (pure JavaScript)
- Receives a query object like `{ age: { $gt: 18 }, name: { $regex: '^A' } }`
- Operates on a plain JS array of document objects loaded from the sheet
- Returns matching documents — no API calls needed for filtering
- Supports: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`,
  `$and`, `$or`, `$not`, `$exists`, `$regex`
- Update engine applies `$set`, `$unset`, `$inc`, `$mul`, `$push`, `$pull`
- Sort and pagination handled here too

### In-Memory Cache
- When a collection is first accessed, all rows are loaded and cached
- Cache has a configurable TTL (default: 30 seconds)
- Writes invalidate the cache for that collection
- Dramatically reduces Sheets API calls for read-heavy workloads

### Write Buffer
- Collects all row changes from an operation
- Flushes to Google Sheets in a single `batchUpdate` call at the end
- Makes `insertMany(1000 docs)` use 1 API call instead of 1000

### Google Sheets Adapter
- Wraps the `google-spreadsheet` package
- Handles authentication
- Implements retry with exponential backoff on 429 / 503 errors
- Provides simple interface: `getRows(sheetName)`, `setRows(sheetName, rows)`,
  `appendRows(sheetName, rows)`, `clearRows(sheetName, rowIndices)`

---

## Data Storage Model

### Collection Sheets (one per collection)

| Row | Content |
|---|---|
| Row 1 | Column headers — clean field names only (`_id`, `name`, `age`, `email`) |
| Row 2+ | Document data, one document per row |

Each document is a flat row. Nested objects and arrays are JSON-stringified
into a single cell.

**Example — "users" sheet:**
```
| _id                                  | name  | age | email             |
| ------------------------------------ | ----- | --- | ----------------- |
| 3f2504e0-4f89-11d3-9a0c-0305e82c3301 | Alice | 25  | alice@example.com |
| 7c9e6679-7425-40de-944b-e07fc1f90ae7 | Bob   | 30  | bob@example.com   |
```

This is readable and editable directly in Google Sheets by the developer.

### `__metadata` Sheet

Stores schema definitions as JSON so they don't pollute column headers.

```
| collection | version | schema_json                                              |
| ---------- | ------- | -------------------------------------------------------- |
| users      | 1       | {"name":{"type":"String","required":true},"age":{...}}  |
```

---

## Full Target API

### Connection

```js
const client = await createClient({ email, key, sheetId });
await client.connect();       // explicit connect (also called implicitly)
await client.disconnect();    // close connection
client.on('connected', fn);
client.on('error', fn);
```

### Collections

```js
const db    = client.db('myapp');           // logical namespace (not a separate sheet)
const users = db.collection('users');       // maps to "users" sheet tab
await users.setSchema({ ... });             // optional schema definition
await users.drop();                         // delete the sheet tab
```

### Insert

```js
await users.insertOne({ name: 'Alice', age: 25 });
// returns: { acknowledged: true, insertedId: 'uuid...' }

await users.insertMany([doc1, doc2, doc3]);
// returns: { acknowledged: true, insertedIds: ['uuid1', 'uuid2', 'uuid3'] }
```

### Read

```js
await users.findOne({ email: 'alice@example.com' });
// returns: single document or null

await users.find({ age: { $gte: 18 } });
// returns: array of matching documents

await users.findById('uuid-string');
// returns: single document or null

await users.find({}).sort({ age: -1 }).limit(10).skip(20);
// returns: paginated, sorted results

await users.countDocuments({ age: { $gt: 18 } });
// returns: number

await users.distinct('city');
// returns: ['London', 'Paris', 'Tokyo']
```

### Update

```js
await users.updateOne(
  { email: 'alice@example.com' },
  { $set: { age: 26 }, $inc: { loginCount: 1 } }
);
// returns: { acknowledged: true, matchedCount: 1, modifiedCount: 1 }

await users.updateMany(
  { age: { $lt: 18 } },
  { $set: { isMinor: true } }
);

await users.findOneAndUpdate(
  { name: 'Alice' },
  { $inc: { loginCount: 1 } },
  { returnDocument: 'after' }
);
// returns: the updated document
```

### Delete

```js
await users.deleteOne({ email: 'alice@example.com' });
// returns: { acknowledged: true, deletedCount: 1 }

await users.deleteMany({ age: { $lt: 13 } });
```

---

## Error Handling

Replace raw `throw new Error('string')` with typed error classes.

```js
class ParasiteError extends Error { constructor(msg, code) { ... } }

class ValidationError   extends ParasiteError { }  // schema constraint violated
class DuplicateKeyError extends ParasiteError { }  // unique field already exists
class ConnectionError   extends ParasiteError { }  // could not reach Google Sheets
class RateLimitError    extends ParasiteError { }  // 429 after all retries exhausted
class DocumentNotFound  extends ParasiteError { }  // findById returned nothing
class SchemaError       extends ParasiteError { }  // invalid schema definition
```

Users can catch specific error types:

```js
try {
  await users.insertOne({ email: 'alice@example.com' });
} catch (err) {
  if (err instanceof DuplicateKeyError) {
    res.status(409).json({ error: 'Email already exists' });
  }
}
```

---

## Schema Definition (redesigned)

```js
users.setSchema({
  name: {
    type:     'String',
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  age: {
    type:    'Integer',
    min:     0,
    max:     150,
    default: 0,
  },
  email: {
    type:    'String',
    required: true,
    unique:  true,
    match:   /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  role: {
    type:    'String',
    enum:    ['admin', 'user', 'guest'],
    default: 'user',
  },
  tags: {
    type:    'Array',    // stored as JSON string in cell
  },
  address: {
    type:    'Object',   // stored as JSON string in cell
  },
  createdAt: {
    type:    'Date',
    default: () => new Date(),
  },
});
```

Schema is optional. Without `setSchema()`, the collection accepts any fields
(schema-less mode, like MongoDB without validation).

---

## What Stays the Same

- Google Sheets as the storage backend — free, always
- One collection = one sheet tab — visible to the developer in the browser
- Service account authentication via `EMAIL` + `KEY` env vars
- `SHEETID` env var pointing at the spreadsheet

---

## What This Enables

| Capability | Before | After |
|---|---|---|
| Complex queries | No | Yes (`$gt`, `$or`, `$regex`, etc.) |
| Safe concurrent requests | No | Yes (no shared Query sheet) |
| Bulk insert 1000 docs | ~1000 API calls | 1 API call |
| Type-safe errors | No | Yes |
| Rate limit resilience | Crashes | Auto-retries |
| Schema evolution | Not possible | Versioned in `__metadata` |
| npm installable | No | Yes |
| TypeScript support | No | Yes |
| Works like MongoDB | Not really | Yes |
