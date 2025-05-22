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

    async commit(){

        for(let i = 0; i < this.buffer.length; i++){

            const query = this.buffer[i];
            const sheet = query.SCHEMA;
            const queryType = query.OPERATION;
            const data = query.DATA;
           

            if(queryType === "CREATE"){
                await sheet.create(data);
                this.buffer[i].STATUS = "COMMITTED";
            }
            
            if(queryType === "UPDATE"){
                await sheet.updateOne({_id: data._id}, data);
                this.buffer[i].STATUS = "COMMITTED";
            }
            
            if(queryType === "DELETE"){
                await sheet.deleteOne(data);
                this.buffer[i].STATUS = "COMMITTED";    
            }
        }

        return "Transaction Committed"
        
        
    }

    async rollback(){
         
        while(!this.checkSafety()){

            const uncommitted = this.buffer.filter(entry => 
                entry.STATUS === "COMMITTED"
            )

            for(let i = this.buffer.length-1; i >= 0; i--){
                let entry = uncommitted[i];
                switch (entry.OPERATION) {

                    case "CREATE":
                    // Try to delete the created row
                    await this.SCHEMA.deleteOne({ _id: entry.DATA._id });
                    this.STATUS = "ROLLBACKED"
                    break;

                    case "DELETE":
                    // Re-create original row if it doesn't exist
                    await this.SCHEMA.create(entry.ORIGINAL);
                    this.STATUS = "ROLLBACKED"
                    break;

                    case "UPDATE":
                    // Restore original only if the current row matches the bad update
                    await this.SCHEMA.updateOne({ _id: entry.DATA._id }, entry.ORIGINAL);
                    this.STATUS = "ROLLBACKED"
                    break;
                }
            }
        }

        
       
    }

    checkSafety(){

        const uncommitted = this.buffer.filter(entry => 
            entry.STATUS === "COMMITTED"
        )

        if(uncommitted.length > 0){
            return false;
        }

        return true;
    }

}

exports.Transaction = Transaction;
