const crypto = require('crypto');


function nanoid(size = 21) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; 
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] & 63]; 
  }
  return id;
}

exports.nanoid = nanoid


