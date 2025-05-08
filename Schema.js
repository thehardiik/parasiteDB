const {DB} = require("./DB")
const {hash} = require("./hashing")

class Schema {

    constructor(schemaName,schemaAttributes){

        let primaryKey = false  // to check is more than one attrubute is primary key

        // JavaScript map method to get Headers
        // Headers :- it is an array of string of all the titles with details about constraints (required and primary key)
        // Headers is required in model object

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

        if(!initInSheets && mode == "create"){
            await this.createSchema();
        }

        if(!this.isInitialized && mode == "find"){
            throw new Error("There is no stored data for this schema")
        }
    }
    

    async create(data) {


        // To check if schema is already present in sheets
        await this.initialiseInSheets("create")

        this.attributes.forEach((attribute) => {

            if(attribute.required && !(attribute.title in data)){
                throw new Error("Required Field is missing");
            }

            if(attribute.primaryKey){
                data.id = hash(data[attribute.title])+1
                console.log(data.id) // ToBe Removed
            }
        });
   
        // Loading all the required cells
        const cells = await this.sheet.loadCells("A" + data.id + ":Z" + data.id);

        // Fix Code :- 3350
        // Fix Code :- 2201

        // Adding new values to the cell
        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title in data){
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + data.id);
                cell.value = data[this.attributes[i].title]
            }  
        }

        await this.sheet.saveUpdatedCells();

        return data
    }

    async findById(id){

        await this.initialiseInSheets("find")

        const cells = await this.sheet.loadCells("A" + id + ":Z" + id);
        let data = {};

        for(let i = 0; i < this.attributes.length; i++){
            let ch = String.fromCharCode('A'.charCodeAt(0) + i);
            const cell = this.sheet.getCellByA1(ch + id);
            const key = this.attributes[i].title
            data[key] = cell.value;
        }

        data.id = id;
        return data;
    }

    async findByPrimaryKey(primaryKey){

        const id = hash(primaryKey)+1
        return this.findById(id)

    }

    async update(primaryKey, data){

        await this.initialiseInSheets("find")


        // To think :- Should we allow user to change primary key
        this.attributes.forEach((attribute) => {

            if(!attribute.primaryKey && attribute.required && !(attribute.title in data)){
                throw new Error("Required Field is missing");
            }

            if(attribute.primaryKey){
                data.id = hash(primaryKey)+1
                console.log(data.id)
            }
        });

        // Loading all the required cells
        const cells = await this.sheet.loadCells("A" + data.id + ":Z" + data.id);

        // Adding new values to the cell
        for(let i = 0; i < this.attributes.length; i++){
            
            if(this.attributes[i].title in data){
                if(this.attributes[i].primaryKey){
                    continue;
                }
                let ch = String.fromCharCode('A'.charCodeAt(0) + i);
                const cell = this.sheet.getCellByA1(ch + data.id);
                cell.value = data[this.attributes[i].title]
            }  
        }

        await this.sheet.saveUpdatedCells();

        return data

    }

    async delete(primaryKey) {

        await this.isInitialized("find")
      
        // Find the row to be deleted based on the primary key
        const rowToDelete = await this.findRow(primaryKey);
      
        // Ensure a row was found
        if (!rowToDelete) {
          throw new Error("No data found with the provided primary key");
        }
      
        // Delete the row using the sheet API
        await this.sheet.deleteRow(rowToDelete.index);
      
        return { message: "Data deleted successfully" };
    }


}

exports.Schema = Schema


