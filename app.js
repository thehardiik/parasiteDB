const express = require("express");
const { DB } = require("./DB");
const { Schema } = require("./Schema");
require('dotenv').config();
const {Transaction} = require("./Transaction")

const app = express();
app.use(express.json());


// Remaining Tasks To Do
// Write transactions.end()
// Fix Locking Mechanism
// Make rollback prone to failure.

const attributes = [
    {
        title: "Name",
        dataType: "String",
        required: true,
        primaryKey: false
    },
    {
        title: "Balance",
        dataType: "Integer",
        required: true,
        primaryKey: false
    },
    {
        title: "Email",
        dataType: "String",
        required: true,
        primaryKey: true
    }
];

const depositAttributes = [
    {
        title: "TransactionID",
        dataType: "Integer",
        required: true,
        primaryKey: true
    },
    {
        title: "AccountID",
        dataType: "String",
        required: true,
        primaryKey: false,
    },
    {
        title: "Amount",
        dataType: "Integer",
        required: true,
        primaryKey: false,
    }
    
]

//Question :-  Relevance of dataType 

const depositSchema = new Schema("depositSchema" , depositAttributes);
const userSchema = new Schema("userSchema" , attributes);


DB.connectDB(process.env.EMAIL, process.env.KEY, process.env.SHEETID)
  .then(() => {
    console.log("Connected to Google Sheets")
    //initSchema();
    
    })
  .catch(err => console.error("Error connecting to Google Sheets:", err));


app.listen(3000, () => {
    console.log("Server is Running");
})


// CREATE Operations
async function openAccount(req, res) {
    
    const { Name, Balance, Email} = req.body; // Destructure data from req.body
    const data = { Name, Balance, Email };
    // Questions: Should Keys be transfered as written in the schema?

    try {
        const newUser = await userSchema.create(data)
        res.status(201).json(newUser);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

// FIND Operations
async function findAccountByName(req, res) {
    
    const {Name} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.find({Name})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function findAccountByBalance(req, res) {
    
    const {Balance} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.find({Balance})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function findAccountByEmail(req, res) {
    
    const {Email} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.find({Email})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function findAccountById(req, res) {
    
    const {_id} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.find({_id})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

// Question: Find One and Find All/Many


// UPDATE Operations

async function updateAccountByEmail(req, res) {
    
    const {OriginalEmail, Name, Balance, Email} = req.body; // Destructure data from req.body
    const data = { Name, Balance, Email};
    const query = { Email: OriginalEmail };
    try {
        const updatedUser = await userSchema.updateOne(query, data)
        res.status(201).json(updatedUser);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function updateAccountById(req, res) {
    
    const {_id, Name, Balance, Email} = req.body; // Destructure data from req.body
    const data = { Name, Balance, Email};
    const query = { _id};
    try {
        const updatedUser = await userSchema.updateOne(query, data)
        res.status(201).json(updatedUser);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

// Question: Can we update primary key?
// Question: Arguments of updateOne


// DELETE Operations


async function deleteAccountByEmail(req, res) {
    
    const {Email} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.deleteOne({Email})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function deleteAccountById(req, res) {
    
    const {_id} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.deleteOne({_id})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}  

// Questions: We need to fix error messages. :- The nan error message.
// Question: Fix the locks.



// Deposit

async function depositAmount(req, res){
    const {TransactionID, AccountID, Amount} = req.body; 

    const trans = new Transaction();

    try {

        trans.start()

        const createdDeposit = await depositSchema.create({TransactionID, AccountID, Amount}, trans)
        console.log("Complete")
        const findAccount = await userSchema.find({_id: AccountID}, trans)
        console.log("Complete")
        const finalAccountBalance = findAccount.Balance + Amount
        const updateUser = await userSchema.updateOne({_id: AccountID, Balance: finalAccountBalance},data = null, trans)
        console.log("Complete")

        trans.commit()


    }catch (error) {
        console.log(error)

        trans.rollback()

    } finally{

        trans.end()
    }
}

async function withdrawAmount(req, res){
    const {TransactionID, AccountID, Amount} = req.body; 

    const trans = new Transaction();

    try {

        trans.start()

        const createdDeposit = await depositSchema.create({TransactionID, AccountID, Amount}, trans)
        console.log("Complete")
        const findAccount = await userSchema.find({_id: AccountID}, trans)
        console.log("Complete")
        const finalAccountBalance = findAccount.Balance - Amount
        const updateUser = await userSchema.updateOne({_id: AccountID, Balance: finalAccountBalance},data = null, trans)
        console.log("Complete")

        trans.commit()


    }catch (error) {
        console.log(error)

        trans.rollback()

    } finally{

        trans.end()
    }
}

async function transferAmount(req, res){
    const {TransactionID, SendAccountID, Amount, RecAccountID} = req.body; 

    const trans = new Transaction();

    try {

        trans.start()

        const createdDeposit = await depositSchema.create({TransactionID, AccountID: SendAccountID, Amount}, trans)
        console.log("Complete")
        const findAccount = await userSchema.find({_id: SendAccountID}, trans)
        console.log("Complete")
        const finalAccountBalance = findAccount.Balance - Amount
        const updateUser = await userSchema.updateOne({_id: SendAccountID, Balance: finalAccountBalance},data = null, trans)
        console.log("Complete")
        const findRecAccount = await userSchema.find({_id: RecAccountID}, trans);
        console.log("Complete")
        const finalRecAccountBalance = findRecAccount.Balance + Amount
        const updateRecUser = await userSchema.updateOne({_id: RecAccountID, Balance: finalRecAccountBalance}, data = null, trans)
        console.log("Complete")

        trans.commit()


    }catch (error) {
        console.log(error)

        trans.rollback()

    } finally{

        trans.end()
    }
}




app.post("/openAccount" , (req, res) => {
    openAccount(req, res);
});

app.post("/findAccountByName" , (req, res) => {
    findAccountByName(req, res);
});

app.post("/findAccountByBalance" , (req, res) => {
    findAccountByBalance(req, res);
});

app.post("/findAccountByEmail" , (req, res) => {
    findAccountByEmail(req, res);
});

app.post("/findAccountById" , (req, res) => {
    findAccountById(req, res);
});


app.post("/updateAccountByEmail" , (req, res) => {
    updateAccountByEmail(req, res);
});

app.post("/updateAccountById" , (req, res) => {
    updateAccountById(req, res);
});

app.post("/deleteAccountByEmail" , (req, res) => {
    deleteAccountByEmail(req, res);
});

app.post("/deleteAccountById" , (req, res) => {
    deleteAccountById(req, res);
});

app.post("/depositAmount" , (req, res) => {
    depositAmount(req, res);
});

app.post("/withdrawAmount" , (req, res) => {
    withdrawAmount(req, res);
});

app.post("/transferAmount" , (req, res) => {
    transferAmount(req, res);
});



