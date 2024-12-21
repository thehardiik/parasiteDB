const crypto = require('crypto');

function hash(input) {
    // Create a hash of the string
    const hash = crypto.createHash('md5').update(input).digest('hex');
    // Convert the hash to a number and take modulo 10^6
    const uniqueInt = parseInt(hash, 16)%99999;
    return uniqueInt;
}

exports.hash = hash


