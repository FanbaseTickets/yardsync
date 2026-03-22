import admin from 'firebase-admin'

export function getAdminDb() {
  if (!admin.apps.length) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY env var is not set')
    const serviceAccount = JSON.parse(key)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
  return admin.firestore()
}
