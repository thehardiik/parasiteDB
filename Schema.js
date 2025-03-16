const {DB} = require("./DB")
const {hash} = require("./hashing")

class Schema {

/*
    Schema Class

    Description:
        Represents a schema for managing data in Google Sheets. The schema maps to a sheet and defines the structure of its attributes, 
        including required fields and primary keys.

    Instance Variables:
        1. name (String):
            - The name of the schema.
        2. attributes (Array of Objects):
            - A list of all attributes in the schema.
            - Each attribute object contains:
                - title (String): The name of the attribute.
                - required (Boolean): Indicates if the attribute is mandatory.
                - primaryKey (Boolean): Indicates if the attribute serves as the primary key.
        3. sheet (Object):
            - Reference to the Google Sheet object from the google-spreadsheet API.
        4. model (Object):
            - Configuration object used during the schema's initialization in Google Sheets.
        5. isInitialized (Boolean):
            - Tracks whether the schema is initialized in Google Sheets.

    Methods:
        1. constructor:
            - Initializes the schema instance with:
                - name: The schema name.
                - attributes: The list of attributes.
                - model: The configuration for schema initialization.
                - sheet: Initially set to null.
                - isInitialized: Initially set to false.
        2. createSchema:
            - Internal method to initialize the schema in Google Sheets.
            - Updates the `sheet` reference and sets `isInitialized` to true.
        3. create:
            - Adds a new data entry to Google Sheets.
            - Takes a data object as input.
        4. findById:
            - Retrieves a data entry using its unique ID.
        5. findByPrimaryKey:
            - Retrieves a data entry using its primary key.
        6. update:
            - Updates an existing data entry in Google Sheets.
            - Takes the primary key and an object with updated data as input.
        7. delete (To Be Implemented):
            - Deletes a data entry using its ID or primary key.
*/



/*
    Constructor: Initializes a Schema instance.

    Parameters:
        1. schemaName (String):
            - The name of the schema.
        2. schemaAttributes (Array of Objects):
            - A list of attributes for the schema.

    Description:
        1. Ensures that the schema has at most one primary key.
        2. Generates an array of header strings (`Headers`) from the schema attributes. Each header includes:
            - The attribute title.
            - Title + :
                - "P" (Primary Key) or "NP" (Not Primary Key).
                - "R" (Required) or "NR" (Not Required).
        3. Creates a `model` object, which is used to initialize the schema in Google Sheets.
*/

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

        const newSheet = await DB.doc.addSheet(this.model)
        this.sheet = newSheet
        this.isInitialized = true;    
    }

    

    async create(data) {


        // To check if schema is already present in sheets
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

        if(!initInSheets){
            await this.createSchema();
        }

        this.attributes.forEach((attribute) => {

            if(attribute.required && !(attribute.title in data)){
                throw new Error("Required Field is missing");
            }

            if(attribute.primaryKey){
                data.id = hash(data[attribute.title])+1
                console.log(data.id)
            }
        });
   
        // Loading all the required cells
        const cells = await this.sheet.loadCells("A" + data.id + ":Z" + data.id);

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

        if(!initInSheets && !this.isInitialized){
            throw new Error("There is no stored data for this schema")
        }

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

        if(!initInSheets && !this.isInitialized){
            throw new Error("There is no stored data to be updated")
        }


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

        // Check if initialization has already occurred
        if (!this.isInitialized) {
          for (let i = 0; i < DB.doc.sheetsByIndex.length; i++) {
            if (this.name === DB.doc.sheetsByIndex[i].title) {
              this.isInitialized = true;
              this.sheet = DB.doc.sheetsByIndex[i];
              break;
            }
          }
        }
      
        // Throw an error if the data hasn't been initialized
        if (!this.isInitialized) {
          throw new Error("There is no stored data to be deleted");
        }
      
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


