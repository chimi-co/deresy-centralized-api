const admin = require('firebase-admin')

admin.initializeApp()

module.exports = {
  auth: admin.auth(),
  db: admin.firestore(),
  storage: admin.storage(),
}
