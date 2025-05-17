const e = require("express")
const {DB} = require("./DB")
const {nanoid} = require("./hashing")
const { logEntry } = require("./logger")

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
        this.loggerConfig = {
            enabled: true,
            logFilePath: "parasite.log.txt",
            redact: []
            
        }

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
            let content = `CREATE SCHEMA : ${this.name} \n`
            logEntry(content);
            await this.createSchema();
        }

        if(!this.isInitialized && mode == "find"){
            throw new Error("There is no stored data for this schema")
        }
    }
    

    async create(data) {

        // Schema Initialization Check
        if(!this.isInitialized){
            await this.initialiseInSheets("create")
        }


        // Data Validation Check
        data._id = 1;
        
        this.attributes.forEach((attribute) => {

            if(attribute.required && !(attribute.title in data)){
                throw new Error("Required Field is missing");
            }

            if(attribute.primaryKey){
                // This needs to be changed
                data._id = nanoid()
            }
        });
        
        // Check if primary key already exist.
        let pk
        let pkIndex

            // Loop To Find Primary Key Index (can we optimize it?) (do we even need primary key in this database?)
        for(let i = 0; i < this.attributes.length; i++){
            if(this.attributes[i].primaryKey){
                pkIndex = i
                pk = String.fromCharCode('A'.charCodeAt(0) + i);
                break;
            }
        }   
        
            // Query to find if given primary key already exist 
        
        let finalQuery = `=FILTER(${this.name}!A:Z, ${this.name}!${pk}:${pk}="${data[this.attributes[pkIndex].title]}")`;
        let formulaCell = await this.query(finalQuery, pk + "1");

        if(formulaCell.value == data[this.attributes[pkIndex].title]){
            throw new Error("Data with this primary key already exist");
        }

        // Get the first empty index
        finalQuery = `=ARRAYFORMULA(MATCH(TRUE, ${this.name}!A:A = "", 0))`
        formulaCell = await this.query(finalQuery, 'A1');
        

        let emptyIndex = 0;

        if(formulaCell.value){
            emptyIndex = Number(formulaCell.value)
        }

        if(emptyIndex == 0){
            throw new Error("Database is working at full utilization")
        }

        // Insert the Data at first empty index.
        let cells = await this.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);
        let content = `CREATE IN ${this.name} : `;

        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title in data){
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + emptyIndex);
                cell.value = data[this.attributes[i].title]

                if(!this.loggerConfig.redact.includes(this.attributes[i].title)){
                    content = content + data[this.attributes[i].title] + " "
                }
                
            }  
        }
            // Log Entry
        content = content + "AT INDEX " + emptyIndex + '\n';
        if(this.loggerConfig.enabled){
            logEntry(content, this.loggerConfig.logFilePath);
        }

        await this.sheet.saveUpdatedCells();

        return data
    }

    async find(query){

        // Shema Intialization Check
        await this.initialiseInSheets("find")

        // Parse query and Log Query
        let content = `FIND IN ${this.name} : `
        const {finalQuery, logContent} = this.parseQuery(query, "DATA");
        content = content + logContent + '\n';
        if(this.loggerConfig.enabled){
            logEntry(content, this.loggerConfig.logFilePath);
        }

        // Step 3 :- Find the row according to query

            // Query to find the row according to query
        
        let formulaCell = await this.query(finalQuery, 'A1');

        let data = {};

            // Prepare the data to return.
        for(let i = 0; i < this.attributes.length; i++){
            let ch = String.fromCharCode('A'.charCodeAt(0) + i);
            const cell = DB.query.getCellByA1(ch + 1);
            const key = this.attributes[i].title
            data[key] = cell.value;
        }

        return data;
    }

    async deleteOne(query){

        // Schema Initialization Check.
        await this.initialiseInSheets("find")

        // Parse Query and Log Query
        let content = `DELETE IN ${this.name} : `
        const {finalQuery, logContent} = this.parseQuery(query, "ROW");
        content = content + logContent + '\n';
        if(this.loggerConfig.enabled){
            logEntry(content, this.loggerConfig.logFilePath);
        }

        // Delete row according to query

            // Query to find the given row;
        let formulaCell = await this.query(finalQuery, 'A1');

        let emptyIndex = 0;

        if(formulaCell.value){
            emptyIndex = Number(formulaCell.value)
        }

        if(emptyIndex == 0){
            throw new Error("No data found with this query")
        }

            // Delete the Data on given row
        let cells = await this.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);

        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title){
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + emptyIndex);
                cell.value = "";
            }  
        }

        await this.sheet.saveUpdatedCells();

        return { message: "Data deleted successfully" };

    }

    async updateOne(query, data){ 

        // Schema Initialization Check
        await this.initialiseInSheets("find")

        // Parse query and Log Query
        let content = `UPDATE IN ${this.name} : `
        const {finalQuery, logContent} = this.parseQuery(query, "ROW");
        content = content + logContent + '\n';
        if(this.loggerConfig.enabled){
            logEntry(content, this.loggerConfig.logFilePath);
        }


        // Update according to query
            // Query to find row to be updated 
        let formulaCell = await this.query(finalQuery, 'A1');

        let emptyIndex = 0;

        if(formulaCell.value){
            emptyIndex = Number(formulaCell.value)
        }

        if(emptyIndex == 0){
            throw new Error("No data found with this query")
        }

        // Update the Data at first empty index.
        let cells = await this.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);

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

    parseQuery(query, querType){

        const queryKeys = Object.keys(query);
        const conditions = [];

        let logContent = ""

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
                    if(!this.loggerConfig.redact.includes(this.attributes[i].title)){
                        logContent = logContent + key + " " + query[key] + " "
                    }
                    found = true;
                    break;
                }
            }

            if (!found) {
                throw new Error(`Attribute '${key}' does not exist.`);
            }
        }

        const queryText = conditions.join(", ");

        let finalQuery = "";

        if(querType == "DATA"){
            finalQuery = `=FILTER(${this.name}!A:Z, ${queryText})`;
        }

        if(querType == "ROW"){
            finalQuery = `=FILTER(ROW(${this.name}!A:Z), ${queryText})`;
        }
       
        return {finalQuery, logContent};

    }

    async query(Query, Cell){

        // Get Cell On which we have to perform query
        let cells = await DB.query.loadCells("A1"  + ":Z1");
        let formulaCell = DB.query.getCellByA1('A1');

        // Add Query Formula
        formulaCell.formula = Query
        await DB.query.saveUpdatedCells();

        // Retrive Queried Cell
        cells = await DB.query.loadCells("A1"  + ":Z1");
        formulaCell = DB.query.getCellByA1(Cell);
        return formulaCell;
    }

    configureLogger(config){
        this.loggerConfig = {
            ...this.loggerConfig, // preserve existing/defaults
            ...config             // override with provided values
        };
    }


}

exports.Schema = Schema


