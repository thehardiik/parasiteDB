const express = require("express");
const { DB } = require("./DB");
const { Schema } = require("./Schema");
require('dotenv').config();
const {Transaction} = require("./Transaction")

const app = express();
app.use(express.json());


const attributes = [
    {
        title: "caption",
        dataType: "String",
        required: true,
        primaryKey: false
    },
    {
        title: "id",
        dataType: "Integer",
        required: true,
        primaryKey: true
    },
    {
        title: "likes",
        dataType: "Integer",
        required: true,
        primaryKey: false
    }
];


const userSchema = new Schema("demnSchema" , attributes);


DB.connectDB(process.env.EMAIL, process.env.KEY, process.env.SHEETID)
  .then(() => {
    console.log("Connected to Google Sheets")
    //initSchema();
    
    })
  .catch(err => console.error("Error connecting to Google Sheets:", err));


app.listen(3000, () => {
    console.log("Server is Running");
})



async function createUser(req, res) {
    
    const { caption, id, likes } = req.body; // Destructure data from req.body
    const data = { caption, id, likes };
    try {
        const newUser = await userSchema.create(data)
        res.status(201).json(newUser);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function updateUser(req, res) {
    
    const { caption, likes, newCaption } = req.body; // Destructure data from req.body
    const data = { caption: newCaption};
    const query = { caption, likes };
    try {
        const updatedUser = await userSchema.updateOne(query, data)
        res.status(201).json(updatedUser);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}



async function findUser(req, res) {
    
    const {caption, likes} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.find({caption, likes})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function deleteUser(req, res) {
    
    const {caption, likes} = req.body; // Destructure data from req.body
    
    try {
        //const User = await userSchema.findById(id)
        const User = await userSchema.deleteOne({caption, likes})
        res.status(201).json(User);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function implementTransaction(req, res) {
    
    
   const { caption, id, likes, _id } = req.body; // Destructure data from req.body

   
    const data = {caption: "Manish", id: 20, likes: 1000};
    const query = { _id};

    const trans = new Transaction();

    try {

        trans.start()
        const deleteUser = await userSchema.deleteOne(query, trans)
        const newUser = await userSchema.create(data, trans)
        //query._id = newUser._id
        
        console.log(trans.buffer)
        
        trans.commit()

        res.status(201).json(newUser);

    } catch (error) {
        trans.rollback()
        res.status(400).json({ error: error.message });
    } finally {
        trans.end()
    }
}



app.post("/createUser" , (req, res) => {
    createUser(req, res);
});

app.post("/findUser" , (req, res) => {
    findUser(req, res);
});

app.post("/deleteUser" , (req, res) => {
    deleteUser(req, res);
});

app.post("/updateUser" , (req, res) => {
    updateUser(req, res);
});

app.post("/transaction" , (req, res) => {
    implementTransaction(req, res);
});

