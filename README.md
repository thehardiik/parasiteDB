# ParasiteDB



**ParasiteDB** is a lightweight, Google Sheets-backed database library that transforms Google Sheets into a functional database with ORM-like capabilities. Perfect for rapid prototyping, small applications, or when you need spreadsheet integration with database functionality.

## ✨ Features

- 🗄️ **ORM-like Interface** - Familiar database operations (CRUD) on Google Sheets
- 🔄 **ACID Transactions** - Full transaction support with commit/rollback
- 📋 **Schema Validation** - Define data structure with type checking and constraints
- 🔒 **Row Locking** - Prevents concurrent modification conflicts
- 📝 **Comprehensive Logging** - Built-in logging with sensitive data redaction
- ⚡ **Auto ID Generation** - Automatic unique identifier creation
- 🛡️ **Error Handling** - Robust error handling and validation

## 🚀 Quick Start

### Installation

```bash
npm install express google-spreadsheet google-auth-library dotenv crypto
```

### Setup

1. **Create Google Service Account**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API
   - Create Service Account and download JSON key

2. **Configure Environment**
   ```env
   EMAIL=your-service-account@project.iam.gserviceaccount.com
   KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
   SHEETID=your-google-sheet-id
   ```

3. **Share Google Sheet** with your service account email

### Basic Usage

```javascript
const { DB } = require('./DB');
const { Schema } = require('./Schema');
require('dotenv').config();

// Define your data structure
const userAttributes = [
    {
        title: "username",
        dataType: "String",
        required: true,
        primaryKey: true
    },
    {
        title: "email", 
        dataType: "String",
        required: true,
        primaryKey: false
    },
    {
        title: "age",
        dataType: "Integer",
        required: false,
        primaryKey: false
    }
];

// Create schema
const userSchema = new Schema("Users", userAttributes);

// Connect to database
async function init() {
    try {
        await DB.connectDB(process.env.EMAIL, process.env.KEY, process.env.SHEETID);
        console.log("✅ Connected to Google Sheets");
        
        // Create a user
        const newUser = await userSchema.create({
            username: "john_doe",
            email: "john@example.com", 
            age: 25
        });
        
        console.log("👤 User created:", newUser);
        
        // Find the user
        const foundUser = await userSchema.find({ username: "john_doe" });
        console.log("🔍 User found:", foundUser);
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

init();
```

## 📚 API Reference

### Schema Operations

```javascript
// Create record
const user = await schema.create({
    username: "alice",
    email: "alice@example.com"
});

// Find record
const user = await schema.find({ username: "alice" });

// Update record  
const updated = await schema.updateOne(
    { username: "alice" },
    { email: "alice.new@example.com" }
);

// Delete record
await schema.deleteOne({ username: "alice" });
```

### Transactions

```javascript
const { Transaction } = require('./Transaction');

const transaction = new Transaction();

try {
    transaction.start();
    
    // Multiple operations in single transaction
    await userSchema.create({ username: "user1", email: "user1@example.com" }, transaction);
    await userSchema.create({ username: "user2", email: "user2@example.com" }, transaction);
    
    await transaction.commit();
    console.log("✅ Transaction completed");
    
} catch (error) {
    await transaction.rollback();
    console.error("❌ Transaction failed:", error.message);
} finally {
    transaction.end();
}
```

## 🏗️ Express.js Integration

```javascript
const express = require('express');
const { DB } = require('./DB');
const { Schema } = require('./Schema');

const app = express();
app.use(express.json());

const postSchema = new Schema("BlogPosts", [
    { title: "title", dataType: "String", required: true, primaryKey: false },
    { title: "id", dataType: "Integer", required: true, primaryKey: true },
    { title: "content", dataType: "String", required: true, primaryKey: false }
]);

// Initialize database connection
DB.connectDB(process.env.EMAIL, process.env.KEY, process.env.SHEETID)
    .then(() => console.log("🗄️ Database connected"))
    .catch(err => console.error("❌ Database connection failed:", err));

// REST API endpoints
app.post('/posts', async (req, res) => {
    try {
        const post = await postSchema.create(req.body);
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/posts/:id', async (req, res) => {
    try {
        const post = await postSchema.find({ id: parseInt(req.params.id) });
        res.json(post);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
});
```

## ⚙️ Configuration

### Logger Configuration

```javascript
schema.configureLogger({
    enabled: true,
    logFilePath: "app.log",
    redact: ["password", "email"] // Hide sensitive fields in logs
});
```

### Schema Attributes

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Column name |
| `dataType` | "String" \| "Integer" | Data type |
| `required` | boolean | Whether field is mandatory |
| `primaryKey` | boolean | Whether field is primary key (only one per schema) |

## 📖 Documentation

For detailed documentation, examples, and advanced usage:

- [Full Documentation](./DOCUMENTATION.md)
- [API Reference](./API.md)
- [Examples](./examples/)
- [Best Practices](./BEST_PRACTICES.md)

## 🔧 Advanced Features

### Batch Operations
```javascript
// Use transactions for multiple operations
const transaction = new Transaction();
transaction.start();

await schema.create(data1, transaction);
await schema.create(data2, transaction);
await schema.updateOne(query, data3, transaction);

await transaction.commit();
```

### Error Handling
```javascript
try {
    await schema.create(invalidData);
} catch (error) {
    if (error.message.includes("Required Field")) {
        // Handle validation error
    } else if (error.message.includes("primary key")) {
        // Handle duplicate key error
    }
}
```

## 🚨 Limitations

- **Performance**: Limited by Google Sheets API quotas (100 requests/100 seconds)
- **Scalability**: Maximum 10 million cells per spreadsheet
- **Queries**: No complex queries (joins, aggregations)
- **Concurrent Users**: Best for small teams or single-user applications

## 🛠️ Troubleshooting

### Common Issues

**Authentication Error**
```bash
Error: Authentication failed
```
- ✅ Verify service account email and private key
- ✅ Ensure Google Sheet is shared with service account
- ✅ Check Google Sheets API is enabled

**Rate Limiting**
```bash
Error: Quota exceeded  
```
- ✅ Reduce operation frequency
- ✅ Use transactions to batch operations
- ✅ Implement retry logic

**Primary Key Violation**
```bash
Error: Data with this primary key already exist
```
- ✅ Ensure unique primary key values
- ✅ Check existing data in spreadsheet

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/parasitedb.git

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Google Sheets credentials

# Run tests
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [google-spreadsheet](https://www.npmjs.com/package/google-spreadsheet)
- Inspired by traditional ORM libraries
- Thanks to Google Sheets API for making this possible

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/parasitedb?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/parasitedb?style=social)
![GitHub issues](https://img.shields.io/github/issues/yourusername/parasitedb)

---

**Made with ❤️ for developers who need simple, spreadsheet-backed databases**

*Perfect for prototyping, small applications, and when you need the power of a database with the familiarity of a spreadsheet.*