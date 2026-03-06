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
        DB.activeTransactions.push(this);
        this.status = "ACTIVE";
    }

    async unlock(){
        // Flush the buffer
        for(let i = 0; i < this.buffer.length; i++){
            
            if(this.buffer[i].STATUS != "UNLOCKED"){
                const query = {_id: this.buffer[i].DATA._id}
                const {finalQuery, logContent} = this.buffer[i].SCHEMA.parseQuery(query, "ROW");
                
                let formulaCell = await this.buffer[i].SCHEMA.query(finalQuery, 'A1');

                let emptyIndex = 0;

                if(formulaCell.value){
                    emptyIndex = Number(formulaCell.value)
                }

                if(emptyIndex == 0){
                    throw new Error("No data found with this query")
                }

                // Update the Data at first empty index.
                let cells = await this.buffer[i].SCHEMA.sheet.loadCells("A" +  emptyIndex  + ":Z" + emptyIndex);

                const cell = await this.buffer[i].SCHEMA.sheet.getCellByA1('Z' + emptyIndex);
                cell.value = "";

                await this.sheet.saveUpdatedCells();

                this.buffer[i].STATUS = "UNLOCKED"
            }     

        }

        this.status = "UNLOCKED"
        DB.activeTransactions.remove()
        
    }

    async Route (){

        while(this.status == "ACTIVE"){
            await this.rollback();
        }

        while(this.status == "COMMITTED" || this.status == "ROLLBACKED"){
            await this.unlock();
        }
    }

    async end(){
        
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

        this.status = "COMMITTED"

        await this.unlock();

        return "Transaction Committed"
        
        
    }


    async rollback(){
         
        while(!this.checkSafety()){

            const uncommitted = this.buffer.filter(entry => 
                entry.STATUS === "COMMITTED"
            )

            for(let i = this.uncommitted.length-1; i >= 0; i--){
                let entry = uncommitted[i];
                switch (entry.OPERATION) {

                    case "CREATE":
                    // Try to delete the created row
                    await entry.SCHEMA.deleteOne({ _id: entry.DATA._id });
                    entry.STATUS = "ROLLBACKED"
                    break;

                    case "DELETE":
                    // Re-create original row if it doesn't exist
                    await entry.SCHEMA.create(entry.ORIGINAL);
                    this.STATUS = "ROLLBACKED"
                    break;

                    case "UPDATE":
                    // Restore original only if the current row matches the bad update
                    await entry.SCHEMA.updateOne({ _id: entry.DATA._id }, entry.ORIGINAL);
                    entry.STATUS = "ROLLBACKED"
                    break;
                }
            }
        }


        this.status = "ROLLBACKED";

        await this.unlock();
   
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
