const {DB} = require("./DB")
const {hash} = require("./hashing")

class Schema {

    constructor(schemaName,schemaAttributes){


        let primaryKey = false 
        const Headers = schemaAttributes.map((attribute) => {

            if(attribute.primaryKey && primaryKey){
                throw new Error("Only one attribute can be primary key")
            }

            let returnValue = attribute.title;

            if(attribute.primaryKey){
                primaryKey = true
                returnValue = returnValue + " " + "P"
            }else{
                returnValue = returnValue + " " + "NP"
            }

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
                rowCount: 100000
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

        let initInSheets

        if(!this.isInitialized){
            for(let i = 0; i < DB.doc.sheetsByIndex.length; i++){
                if(this.name == DB.doc.sheetsByIndex[i].title){
                    initInSheets = true;
                    this.isInitialized = true;
                    this.sheet = DB.doc.sheetsByIndex[i];
                    // To Do  - add this.sheets
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

    // Method READ of CRUD

    // by id
    async find(id){

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


}


exports.Schema = Schema


