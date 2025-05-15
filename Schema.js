const e = require("express")
const {DB} = require("./DB")
const {hash} = require("./hashing")

class Schema {

    constructor(schemaName,schemaAttributes){

        let primaryKey = false  // to check is more than one attrubute is primary key

        // JavaScript map method to get Headers
        // Headers :- it is an array of string of all the titles with details about constraints (required and primary key)
        // Headers is required in model object

        schemaAttributes.unshift({
            title: "_id",
            dataType: "String",
            required: true,
            primaryKey: false
        })

        const Headers = schemaAttributes.map((attribute) => {

            if(attribute.primaryKey && primaryKey){
                throw new Error("Only one attribute can be primary key")
            }

            let returnValue = attribute.title; 

            // Add P if primary key, NP if not a primary key
            if(attribute.primaryKey){
                primaryKey = true
                returnValue = returnValue + " " + "P" 
            }else{
                returnValue = returnValue + " " + "NP"
            }

            // Add R to attribute if Required, NR if not required
            if(attribute.required){
                returnValue = returnValue + " " + "R"
            }else{
                returnValue = returnValue + " " + "NR"
            }
    
            return returnValue
        })

    
        const model = {
            title: schemaName,
            headerValues: Headers,
            gridProperties: {
                rowCount: 100000    // To be fixed.
            }     
        }

        this.name = schemaName;
        this.attributes = schemaAttributes
        this.sheet = null
        this.model = model
        this.isInitialized = false;
    }

    
    async createSchema(){

        if(!DB.doc){
            return null
        }

        // Fix Code :- 2201
        const newSheet = await DB.doc.addSheet(this.model)
        this.sheet = newSheet
        this.isInitialized = true;    
    }

    async initialiseInSheets(mode){

        let initInSheets

        if(!this.isInitialized){
            for(let i = 0; i < DB.doc.sheetsByIndex.length; i++){
                if(this.name == DB.doc.sheetsByIndex[i].title){
                    initInSheets = true;
                    this.isInitialized = true;
                    this.sheet = DB.doc.sheetsByIndex[i];
                    // To Do  - Validation that initilized schema is as same as schema in google sheets
                    break;
                }
            }
        }

        if(!this.isInitialized && mode == "create"){
            await this.createSchema();
        }

        if(!this.isInitialized && mode == "find"){
            throw new Error("There is no stored data for this schema")
        }
    }
    

    async createData(data) {

        // To check if schema is already present in sheets
        if(!this.isInitialized){
            await this.initialiseInSheets("create")
        }

        // Data Validation Part
        data._id = 1;
        
        this.attributes.forEach((attribute) => {

            if(attribute.required && !(attribute.title in data)){
                throw new Error("Required Field is missing");
            }

            if(attribute.primaryKey){
                // This needs to be changed
                data._id = hash(data[attribute.title])+1
            }
        });
        
        // Check if primary key already exist.
        let pk
        let pkIndex

        for(let i = 0; i < this.attributes.length; i++){
            if(this.attributes[i].primaryKey){
                pkIndex = i
                pk = String.fromCharCode('A'.charCodeAt(0) + i);
                break;
            }
        
        }   

        let cells = await DB.query.loadCells("A1"  + ":Z1");
        let formulaCell = DB.query.getCellByA1('A1');
        formulaCell.formula = `=FILTER(demnSchema!A:Z, demnSchema!${pk}:${pk}="${data[this.attributes[pkIndex].title]}")`

        await DB.query.saveUpdatedCells();

        cells = await DB.query.loadCells("A1"  + ":Z1");
        formulaCell = DB.query.getCellByA1(pk + "1");

        if(formulaCell.value == data[this.attributes[pkIndex].title]){
            throw new Error("Data with this primary key already exist");
        }

        // Get the first empty index
        formulaCell = DB.query.getCellByA1('A1');
        formulaCell.formula = `=ARRAYFORMULA(MATCH(TRUE, ${this.name}!A:A = "", 0))`
        await DB.query.saveUpdatedCells();

        cells = await DB.query.loadCells("A1"  + ":Z1");
        formulaCell = DB.query.getCellByA1('A1');

        let emptyIndex = 0;

        if(formulaCell.value){
            emptyIndex = Number(formulaCell.value)
        }

        if(emptyIndex == 0){
            throw new Error("Database is working at full utilization")
        }

        // Insert the Data at first empty index.
        cells = await this.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);

        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title in data){
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + emptyIndex);
                cell.value = data[this.attributes[i].title]
            }  
        }

        await this.sheet.saveUpdatedCells();

        return data
    }

    

    async find(query){

        // Step 1 :- Check for schema in sheets
        await this.initialiseInSheets("find")

        // Step 2 :- Parse query
        const queryKeys = Object.keys(query);
        const conditions = [];

        for (const key of queryKeys) {
            let found = false;
            
            for (let i = 0; i < this.attributes.length; i++) {
                if (this.attributes[i].title === key) {
                    const ch = String.fromCharCode('A'.charCodeAt(0) + i);
                    if(this.attributes[i].dataType == "Integer"){
                        conditions.push(`${this.name}!${ch}:${ch}=${query[key]}`);
                    }else{
                        conditions.push(`${this.name}!${ch}:${ch}="${query[key]}"`);
                    }
                    found = true;
                    break;
                }
            }

            if (!found) {
                throw new Error(`Attribute '${key}' does not exist.`);
            }
        }

        console.log(conditions)

        const queryText = conditions.join(", ");
        const finalQuery = `=FILTER(${this.name}!A:Z, ${queryText})`;

        console.log(finalQuery)


        // Step 3 :- find the row according to query

        let cells = await DB.query.loadCells("A1"  + ":Z1");
        let formulaCell = DB.query.getCellByA1('A1');

        formulaCell.formula = finalQuery
        await DB.query.saveUpdatedCells();

        cells = await DB.query.loadCells("A1"  + ":Z1");
        formulaCell = DB.query.getCellByA1('A1');

        let data = {};

        for(let i = 0; i < this.attributes.length; i++){
            let ch = String.fromCharCode('A'.charCodeAt(0) + i);
            const cell = DB.query.getCellByA1(ch + 1);
            const key = this.attributes[i].title
            data[key] = cell.value;
        }

        return data;
    }

    async deleteOne(query){

        // Step 1 :- Check for schema in sheets
        await this.initialiseInSheets("find")

        // Step 2 :- Parse query
        const queryKeys = Object.keys(query);
        const conditions = [];

        for (const key of queryKeys) {
            let found = false;
            
            for (let i = 0; i < this.attributes.length; i++) {
                if (this.attributes[i].title === key) {
                    const ch = String.fromCharCode('A'.charCodeAt(0) + i);
                    if(this.attributes[i].dataType == "Integer"){
                        conditions.push(`${this.name}!${ch}:${ch}=${query[key]}`);
                    }else{
                        conditions.push(`${this.name}!${ch}:${ch}="${query[key]}"`);
                    }
                    found = true;
                    break;
                }
            }

            if (!found) {
                throw new Error(`Attribute '${key}' does not exist.`);
            }
        }

        console.log(conditions)

        const queryText = conditions.join(", ");
        const finalQuery = `=FILTER(ROW(${this.name}!A:Z), ${queryText})`;

        console.log(finalQuery)

        let cells = await DB.query.loadCells("A1"  + ":Z1");
        let formulaCell = DB.query.getCellByA1('A1');

        formulaCell.formula = finalQuery
        await DB.query.saveUpdatedCells();

        cells = await DB.query.loadCells("A1"  + ":Z1");
        formulaCell = DB.query.getCellByA1('A1');

        let emptyIndex = 0;

        if(formulaCell.value){
            emptyIndex = Number(formulaCell.value)
        }

        if(emptyIndex == 0){
            throw new Error("No data found with this query")
        }

        // Insert the Data at first empty index.
        cells = await this.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);

        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title){
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + emptyIndex);
                cell.value = null;
            }  
        }

        await this.sheet.saveUpdatedCells();

        return { message: "Data deleted successfully" };

    }

    async updateOne(query, data){ 

        // Step 1 :- Check for schema in sheets
        await this.initialiseInSheets("find")

        // Step 2 :- Parse query
        const queryKeys = Object.keys(query);
        const conditions = [];

        for (const key of queryKeys) {
            let found = false;
            
            for (let i = 0; i < this.attributes.length; i++) {
                if (this.attributes[i].title === key) {
                    const ch = String.fromCharCode('A'.charCodeAt(0) + i);
                    if(this.attributes[i].dataType == "Integer"){
                        conditions.push(`${this.name}!${ch}:${ch}=${query[key]}`);
                    }else{
                        conditions.push(`${this.name}!${ch}:${ch}="${query[key]}"`);
                    }
                    found = true;
                    break;
                }
            }

            if (!found) {
                throw new Error(`Attribute '${key}' does not exist.`);
            }
        }

        console.log(conditions)

        const queryText = conditions.join(", ");
        const finalQuery = `=FILTER(ROW(${this.name}!A:Z), ${queryText})`;

        console.log(finalQuery)

        let cells = await DB.query.loadCells("A1"  + ":Z1");
        let formulaCell = DB.query.getCellByA1('A1');

        formulaCell.formula = finalQuery
        await DB.query.saveUpdatedCells();

        cells = await DB.query.loadCells("A1"  + ":Z1");
        formulaCell = DB.query.getCellByA1('A1');

        let emptyIndex = 0;

        if(formulaCell.value){
            emptyIndex = Number(formulaCell.value)
        }

        if(emptyIndex == 0){
            throw new Error("No data found with this query")
        }

        // Insert the Data at first empty index.
        cells = await this.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);

        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title in data){
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + emptyIndex);
                cell.value = data[this.attributes[i].title]
            }  
        }

        await this.sheet.saveUpdatedCells();

        return data
    }



}

exports.Schema = Schema


