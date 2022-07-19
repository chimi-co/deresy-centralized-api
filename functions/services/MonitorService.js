const functions = require('firebase-functions')

const { db } = require('../firebase')
const { saveForm, saveRequest, saveReviews } = require('./DeresyDBService')
const web3 = require('../web3')
const { MINTED_BLOCK_COLLECTION } = require('../constants/collections')
const {
  DERESY_CONTRACT_ABI,
  DERESY_CONTRACT_ADDRESS,
} = require('../constants/contractConstants')

const mintedBlockRef = db.collection(MINTED_BLOCK_COLLECTION)

const writeFormToDB = async (formID, tx, reviewForm) => {
  const choicesObj = reviewForm[2].map(choices => {
    return { choices: choices }
  })
  const data = {
    formID: parseInt(formID),
    questions: reviewForm[0],
    types: reviewForm[1],
    choices: choicesObj,
    tx: tx,
  }
  await saveForm(formID, data)
}

const writeRequestToDB = async (requestName, reviewRequest, tx) => {
  const data = {
    requestName: requestName,
    reviewers: reviewRequest.reviewers,
    targets: reviewRequest.targets,
    targetsIPFSHashes: reviewRequest.targetsIPFSHashes,
    formIpfsHash: reviewRequest.formIpfsHash,
    rewardPerReview: reviewRequest.rewardPerReview,
    isClosed: reviewRequest.isClosed,
    tx: tx,
  }

  await saveRequest(requestName, data)
}

const writeReviewsToDB = async (requestName, reviews) => {
  const reviewsArray = []

  reviews.forEach(review => {
    const reviewObj = {
      reviewer: review.reviewer,
      targetIndex: review.targetIndex,
      answers: review.answers,
    }

    reviewsArray.push(reviewObj)
  })

  const data = {
    requestName: requestName,
    reviews: reviewsArray,
  }

  await saveReviews(requestName, data)
}

const processForms = async startMintBlock => {
  const smartContract = new web3.eth.Contract(
    DERESY_CONTRACT_ABI,
    DERESY_CONTRACT_ADDRESS,
  )
  const snapshot = await mintedBlockRef
    .where('monitorType', '==', 'forms')
    .limit(1)
    .get()

  const lastBlockDoc = snapshot.docs[0]

  const pastEvents = await smartContract.getPastEvents(
    'CreatedReviewForm',
    {},
    //toBlock: + maxNumber var
    { fromBlock: startMintBlock, toBlock: 'latest' },
  )

  for (let i = 0; i < pastEvents.length; i++) {
    const formID = pastEvents[i].returnValues._formId
    const lastMintBlock = pastEvents[i].blockNumber
    if (formID > lastBlockDoc.data().lastFormID) {
      const tx = pastEvents[i].transactionHash
      const reviewForm = await smartContract.methods
        .getReviewForm(formID)
        .call()

      await writeFormToDB(formID, tx, reviewForm)

      await mintedBlockRef
        .doc(lastBlockDoc.id)
        .update({ lastFormID: parseInt(formID) })
      await mintedBlockRef
        .doc(lastBlockDoc.id)
        .update({ lastSuccessTime: new Date() })
    }
    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ blockNumber: lastMintBlock })
  }
}

const processRequests = async startMintBlock => {
  const smartContract = new web3.eth.Contract(
    DERESY_CONTRACT_ABI,
    DERESY_CONTRACT_ADDRESS,
  )
  const snapshot = await mintedBlockRef
    .where('monitorType', '==', 'requests')
    .limit(1)
    .get()

  const lastBlockDoc = snapshot.docs[0]

  const pastCreatedEvents = await smartContract.getPastEvents(
    'CreatedReviewRequest',
    {},
    { fromBlock: startMintBlock, toBlock: 'latest' },
  )
  const pastClosedEvents = await smartContract.getPastEvents(
    'ClosedReviewRequest',
    {},
    { fromBlock: startMintBlock, toBlock: 'latest' },
  )
  const pastEvents = pastCreatedEvents.concat(pastClosedEvents).sort((a, b) => {
    return a.blockNumber - b.blockNumber
  })

  for (let i = 0; i < pastEvents.length; i++) {
    const requestName = pastEvents[i].returnValues._requestName
    const lastMintBlock = pastEvents[i].blockNumber
    const tx = pastEvents[i].transactionHash
    const reviewRequest = await smartContract.methods
      .getRequest(requestName)
      .call()

    await writeRequestToDB(requestName, reviewRequest, tx)

    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ lastRequestName: requestName })
    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ lastSuccessTime: new Date() })
    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ blockNumber: lastMintBlock })
  }
}

const processReviews = async startMintBlock => {
  const smartContract = new web3.eth.Contract(
    DERESY_CONTRACT_ABI,
    DERESY_CONTRACT_ADDRESS,
  )
  const snapshot = await mintedBlockRef
    .where('monitorType', '==', 'reviews')
    .limit(1)
    .get()

  const lastBlockDoc = snapshot.docs[0]

  const pastEvents = await smartContract.getPastEvents(
    'SubmittedReview',
    {},
    { fromBlock: startMintBlock, toBlock: 'latest' },
  )

  for (let i = 0; i < pastEvents.length; i++) {
    const requestName = pastEvents[i].returnValues._requestName
    const lastMintBlock = pastEvents[i].blockNumber
    const tx = pastEvents[i].transactionHash
    const reviewRequest = await smartContract.methods
      .getRequest(requestName)
      .call()

    await writeReviewsToDB(requestName, reviewRequest.reviews, tx)

    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ lastRequestName: requestName })
    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ lastSuccessTime: new Date() })
    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ blockNumber: lastMintBlock })
  }
}

const monitorForms = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '8GB',
  })
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    try {
      let lastMintBlock
      const snapshot = await mintedBlockRef
        .where('monitorType', '==', 'forms')
        .limit(1)
        .get()

      const doc = snapshot.docs[0]

      if (!doc.exists) {
        lastMintBlock = 0
      } else {
        lastMintBlock = doc.data().blockNumber
      }

      let startMintBlock = lastMintBlock + 1
      if (
        !doc.data().formsInProgress || // check if a mint is already in progress
        new Date() - doc.data().lastSuccessTime.toDate() > 540000 // go ahead and run if it's been 9 minutes since last successful run
      ) {
        await mintedBlockRef.doc(doc.id).update({ formsInProgress: true })
        await processForms(startMintBlock)
        await mintedBlockRef.doc(doc.id).update({ formsInProgress: false })
        await mintedBlockRef.doc(doc.id).update({ lastSuccessTime: new Date() })
      }
    } catch (error) {
      functions.logger.error('[ !!! ] Error: ', error)
      throw new functions.https.HttpsError(error.code, error.message)
    }
  })

const monitorRequests = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '8GB',
  })
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    try {
      let lastUpdateBlock
      const snapshot = await mintedBlockRef
        .where('monitorType', '==', 'requests')
        .limit(1)
        .get()
      const doc = snapshot.docs[0]
      if (!doc.exists) {
        lastUpdateBlock = 0
      } else {
        lastUpdateBlock = doc.data().blockNumber
      }

      let startUpdateBlock = lastUpdateBlock + 1
      if (
        !doc.data().requestsInProgress || // check if an update is already in progress
        new Date() - doc.data().lastSuccessTime.toDate() > 540000 // go ahead and run if it's been 9 minutes since last successful run
      ) {
        await mintedBlockRef.doc(doc.id).update({ requestsInProgress: true })
        await processRequests(startUpdateBlock)
        await mintedBlockRef.doc(doc.id).update({ requestsInProgress: false })
        await mintedBlockRef.doc(doc.id).update({ lastSuccessTime: new Date() })
      }
    } catch (error) {
      functions.logger.error('[ !!! ] Error: ', error)
      throw new functions.https.HttpsError(error.code, error.message)
    }
  })

const monitorReviews = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '8GB',
  })
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    try {
      let lastUpdateBlock
      const snapshot = await mintedBlockRef
        .where('monitorType', '==', 'reviews')
        .limit(1)
        .get()
      const doc = snapshot.docs[0]
      if (!doc.exists) {
        lastUpdateBlock = 0
      } else {
        lastUpdateBlock = doc.data().blockNumber
      }

      let startUpdateBlock = lastUpdateBlock + 1
      if (
        !doc.data().requestsInProgress || // check if an update is already in progress
        new Date() - doc.data().lastSuccessTime.toDate() > 540000 // go ahead and run if it's been 9 minutes since last successful run
      ) {
        await mintedBlockRef.doc(doc.id).update({ reviewsInProgress: true })
        await processReviews(startUpdateBlock)
        await mintedBlockRef.doc(doc.id).update({ reviewsInProgress: false })
        await mintedBlockRef.doc(doc.id).update({ lastSuccessTime: new Date() })
      }
    } catch (error) {
      functions.logger.error('[ !!! ] Error: ', error)
      throw new functions.https.HttpsError(error.code, error.message)
    }
  })

module.exports = {
  monitorForms,
  monitorRequests,
  monitorReviews,
}
