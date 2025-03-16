const Spreadsheet = require("google-spreadsheet")
const google = require("google-auth-library")

class DB {
    
    static doc = null;

    static async connectDB(email, key, sheetID){

        const serviceAccountAuth = new google.JWT({
            email: email,
            key: key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
        
          
        
        const doc = new Spreadsheet.GoogleSpreadsheet(sheetID, serviceAccountAuth);
        await doc.loadInfo(); // loads document properties and worksheets
        this.doc = doc

        // ToDo :- We need to track no. of cells used.
    }
}

exports.DB = DB