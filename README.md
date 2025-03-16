# ParasiteDB Documentation

## Introduction
ParasiteDB is a lightweight Node.js library that utilizes Google Sheets as a cloud-based database. It provides an abstraction layer to perform CRUD operations on Google Sheets while allowing schema definition, primary key management, and data validation.

## Installation
Ensure you have Node.js installed and then include ParasiteDB in your project:

```bash
npm install google-spreadsheet express dotenv
```

Create a `.env` file in your project root with the following:

```plaintext
EMAIL=your-service-account-email
KEY=your-private-key
SHEETID=your-google-sheet-id
```

## Setup
Create a basic Express server to integrate ParasiteDB:

```javascript
const express = require("express");
const { DB } = require("./DB");
const { Schema } = require("./Schema");
require('dotenv').config();

const app = express();
app.use(express.json());

DB.connectDB(process.env.EMAIL, process.env.KEY, process.env.SHEETID)
  .then(() => console.log("Connected to Google Sheets"))
  .catch(err => console.error("Error connecting to Google Sheets:", err));

app.listen(3000, () => console.log("Server is running"));
```

## Schema Definition
Define a schema for your Google Sheet with attributes:

```javascript
const attributes = [
    { title: "caption", dataType: "String", required: true, primaryKey: false },
    { title: "id", dataType: "Integer", required: true, primaryKey: true },
    { title: "likes", dataType: "Integer", required: true, primaryKey: false }
];

const userSchema = new Schema("userSchema", attributes);
```

### Attribute Constraints
- `title`: Attribute name.
- `dataType`: Defines the data type (`String`, `Integer`).
- `required`: If `true`, the attribute must be provided during CRUD operations.
- `primaryKey`: Only one attribute can have this set to `true`.

## CRUD Operations

### Create a New Entry
Adds a new row to the Google Sheet.

```javascript
async function createUser(req, res) {
    const { caption, id, likes } = req.body;
    try {
        const newUser = await userSchema.create({ caption, id, likes });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
```

**Constraints:**
- All `required` attributes must be provided.
- `primaryKey` is auto-generated using a hash function.

### Read an Entry by Primary Key
Fetches a row using the primary key.

```javascript
async function getUser(req, res) {
    const { id } = req.body;
    try {
        const user = await userSchema.findByPrimaryKey(id);
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
```

**Constraints:**
- Requires a valid `primaryKey`.
- Throws an error if the key doesn't exist.

### Update an Entry
Modifies an existing row.

```javascript
async function updateUser(req, res) {
    const { caption, primaryKey, likes } = req.body;
    try {
        const updatedUser = await userSchema.update(primaryKey, { caption, likes });
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
```

**Constraints:**
- `primaryKey` must be provided.
- All `required` attributes, except the `primaryKey`, must be included.

### Delete an Entry
Removes a row using the primary key.

```javascript
async function deleteUser(req, res) {
    const { primaryKey } = req.body;
    try {
        const result = await userSchema.delete(primaryKey);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
```

**Constraints:**
- Requires a valid `primaryKey`.
- Throws an error if the entry doesn't exist.

## API Endpoints

| Method | Endpoint      | Description       |
|------- |---------------|------------------|
| POST   | /createUser   | Create new entry |
| POST   | /getUser      | Get entry by key |
| POST   | /updateUser   | Update an entry  |
| POST   | /deleteUser   | Delete an entry  |

## Error Handling
- `"Only one attribute can be primary key"`: Occurs if multiple primary keys are defined.
- `"Required Field is missing"`: Happens when `required` attributes are not provided.
- `"There is no stored data for this schema"`: When attempting to read from an uninitialized schema.
- `"No data found with the provided primary key"`: For non-existing entries.

## Conclusion
ParasiteDB simplifies working with Google Sheets by adding a structured schema layer and CRUD operations. It is ideal for lightweight, cloud-based apps where Google Sheets acts as a database.

---
Feel free to extend functionalities or raise issues!

