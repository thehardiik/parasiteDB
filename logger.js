const fs = require('node:fs');
const path = require('node:path');



function logEntry(log, pathName){

    const logFilePath = path.join(__dirname, pathName);
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${log}`;

    fs.appendFile(logFilePath, logLine, err => {
        if (err) {
            throw new Error("Logging Failed : ");
        }
    });
}

exports.logEntry = logEntry;