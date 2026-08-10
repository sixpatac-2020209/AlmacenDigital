/**
 * Usage: node set-admin-claim.js /path/to/serviceAccountKey.json user@example.com
 *
 * This script sets the custom claim `admin: true` for the specified user.
 * You must install firebase-admin: `npm install firebase-admin` and have Node.js.
 */

const admin = require('firebase-admin');
const fs = require('fs');

if (process.argv.length < 4) {
  console.error('Usage: node set-admin-claim.js <serviceAccountKey.json> <userEmail>');
  process.exit(1);
}

const keyPath = process.argv[2];
const userEmail = process.argv[3];

if (!fs.existsSync(keyPath)) {
  console.error('Service account key not found at', keyPath);
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.auth().getUserByEmail(userEmail)
  .then(userRecord => {
    console.log('Found user:', userRecord.uid, userRecord.email);
    return admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
  })
  .then(() => {
    console.log('Custom claim `admin: true` set for', userEmail);
    console.log('The client may need to sign out and sign in again to refresh token.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
