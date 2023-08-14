const { db } = require('../firebase')

const {
  FORMS_COLLECTION,
  REVIEW_REQUESTS_COLLECTION,
  REVIEWS_COLLECTION,
  GRANTS_COLLECTION,
} = require('../constants/collections')
const formsRef = db.collection(FORMS_COLLECTION)
const reviewRequestsRef = db.collection(REVIEW_REQUESTS_COLLECTION)
const reviewsRef = db.collection(REVIEWS_COLLECTION)
const grantsRef = db.collection(GRANTS_COLLECTION)

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
  const snapshot = await reviewRequestsRef
    .where('requestName', '==', requestName)
    .limit(1)
    .get()

  if (snapshot.empty) {
    await reviewRequestsRef.add({
      ...data,
    })
  } else {
    const document = reviewRequestsRef.doc(snapshot.docs[0].id)
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

const updateGrant = async (id, payload) => {
  await grantsRef.doc(id).update({ ...payload })
}

const getGrantByTarget = async requestTarget => {
  const snapshot = await grantsRef
    .where('request_target', '==', requestTarget)
    .limit(1)
    .get()

  return { documentId: snapshot.docs[0].id, ...snapshot.docs[0].data() }
}

const getReviewRequest = async requestName => {
  const snapshot = await reviewRequestsRef
    .where('requestName', '==', requestName)
    .limit(1)
    .get()
  return snapshot.docs[0].data()
}

const getReviews = async requestName => {
  const snapshot = await reviewsRef
    .where('requestName', '==', requestName)
    .limit(1)
    .get()
  return snapshot.docs[0].data()
}

module.exports = {
  getGrantByTarget,
  getReviews,
  getReviewRequest,
  saveForm,
  saveRequest,
  saveReviews,
  updateGrant,
}
