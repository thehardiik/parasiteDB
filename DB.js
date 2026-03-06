const Spreadsheet = require("google-spreadsheet")
const google = require("google-auth-library");

class DB {
    
    static doc = null;

    activeTransactions = [];

    static async connectDB(email, key, sheetID){
            
        const serviceAccountAuth = new google.JWT({
            email: email,
            key: key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
        
          
        
        const doc = new Spreadsheet.GoogleSpreadsheet(sheetID, serviceAccountAuth);
        await doc.loadInfo(); // loads document properties and worksheets
        //console.log(doc)
        this.doc = doc
        
        const querySheetExists = this.doc.sheetsByIndex.find(sheet => sheet.title === "Query");

        if (!querySheetExists) {
            console.log("True")
            const model = {
                title: "Query",
                gridProperties: {
                    rowCount: 100000    // To be fixed.
                }     
            }
            const query = await this.doc.addSheet(model)
            this.query = query
        }else{
            this.query = querySheetExists
        }

        // ToDo :- We need to track no. of cells used.
        // Fix Code :- 2201
    }

    async safetyCheck(){
        // Check all the active transactions and call route function for them to ensure they are rollbacked and unlocked
    }


}



exports.DB = DB
