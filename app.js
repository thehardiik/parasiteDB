const express = require("express");
const { DB } = require("./DB");
const { Schema } = require("./Schema");
require('dotenv').config();



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

app.post("/createUser" , (req, res) => {
    createUser(req, res);
});

