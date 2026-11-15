const bcrypt = require("bcryptjs");

const password = process.argv[2] || "cueclub_default";
const rounds = 10;

const hash = bcrypt.hashSync(password, rounds);
console.log(`Password: ${password}`);
console.log(`Bcrypt Hash: ${hash}`);
console.log(`Verified: ${bcrypt.compareSync(password, hash)}`);
console.log("\nSQL update statement:");
console.log(`UPDATE Users SET password_hash = '${hash}';`);
