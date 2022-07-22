const { db } = require('../firebase')

const {
  FORMS_COLLECTION,
  REQUESTS_COLLECTION,
  REVIEWS_COLLECTION,
} = require('../constants/collections')
const formsRef = db.collection(FORMS_COLLECTION)
const requestsRef = db.collection(REQUESTS_COLLECTION)
const reviewsRef = db.collection(REVIEWS_COLLECTION)

const saveForm = async (formID, data) => {
  const snapshot = await formsRef
    .where('formID', '==', parseInt(formID))
    .limit(1)
    .get()

  if (snapshot.empty) {
    await formsRef.add({
      ...data,
    })
  } else {
    const document = formsRef.doc(snapshot.docs[0].id)
    await document.update({
      ...data,
    })
  }
}

const saveRequest = async (requestName, data) => {
  const snapshot = await requestsRef
    .where('requestName', '==', requestName)
    .limit(1)
    .get()

  if (snapshot.empty) {
    await requestsRef.add({
      ...data,
    })
  } else {
    const document = requestsRef.doc(snapshot.docs[0].id)
    await document.update({
      ...data,
    })
  }
}

const saveReviews = async (requestName, data) => {
  const snapshot = await reviewsRef
    .where('requestName', '==', requestName)
    .limit(1)
    .get()

  if (snapshot.empty) {
    await reviewsRef.add({
      ...data,
    })
  } else {
    const document = reviewsRef.doc(snapshot.docs[0].id)
    await document.update({
      ...data,
    })
  }
}

module.exports = {
  saveForm,
  saveRequest,
  saveReviews,
}
