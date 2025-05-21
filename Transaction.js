const { DB } = require("./DB");
const { nanoid } = require("./hashing");

class Transaction {

    constructor(){

        const transactionID = nanoid(10);
        this.transactionId = transactionID;
        this.status = "INACTIVE";
        this.buffer = [] 
    }

    start(){
        this.status = "ACTIVE";
    }

    end(){
        // Flush the buffer
        this.status = "INACTIVE";
    }

    commit(){
        
        // If we reached here, it means that all the queries in transaction will not fail.
        // Update all the queries in the transaction to the sheets.
               // CREATE :- simply create a new row in the sheet.
               // READ :- Only unlock is needed.
               // UPDATE :- If the row exist in the buffer, the update will be done in the buffer, and in sequence
               // DELETE :- If the row exist in the buffer, the queries for same row before deletion will not be valid.
        // Unlock all the sheets.
        // Mark the transaction as COMMITTED.
    }

    rollback(){
         
        // Something bad has happened
        // Revert all the queries which were updated in transaction.
        // We have to maintain the initial state of the sheets.
        // Unlock all the sheets.
        // Mark the transaction as ROLLBACKED.
    }

}

exports.Transaction = Transaction;
