const functions = require('firebase-functions')

const { db } = require('../firebase')
const {
  saveForm,
  saveRequest /* closeRequest, saveReview */,
} = require('../DeresyDBService')
const web3 = require('../web3')
const { MINTED_BLOCK_COLLECTION } = require('../constants/collections')
const {
  contractABI,
  contractAddress,
} = require('../constants/contractConstants')

const mintedBlockRef = db.collection(MINTED_BLOCK_COLLECTION)

const writeFormToDB = async (formID, tx, reviewForm) => {
  const data = {
    formID: parseInt(formID),
    questions: reviewForm[0],
    types: reviewForm[1],
    choices: reviewForm[2],
    tx: tx,
  }

  await saveForm(formID, data)
}

const writeRequestToDB = async (
  requestName,
  reviewers,
  targets,
  targetsIPFSHashes,
  formIpfsHash,
  rewardPerReview,
) => {
  const data = {
    requestName: requestName,
    reviewers: reviewers,
    targets: targets,
    targetsIPFSHashes: targetsIPFSHashes,
    formIpfsHash: formIpfsHash,
    rewardPerReview: rewardPerReview,
  }

  await saveRequest(requestName, data)
}
/*
const writeReviewToDB = async (
  requestName,
  reviewers,
  targets,
  targetsIPFSHashes,
  formIpfsHash,
  rewardPerReview,
) => {
  const data = {
    requestName: requestName,
    reviewers: reviewers,
    targets: targets,
    targetsIPFSHashes: targetsIPFSHashes,
    formIpfsHash: formIpfsHash,
    rewardPerReview: rewardPerReview,
  }

  await saveReview(data)
}

const closeRequestDB = async (
  requestName,
) => {
  const data = {
    isClosed: true,
  }

  await closeRequest(requestName, data)
}
*/
const processFormCreated = async startMintBlock => {
  const smartContract = new web3.eth.Contract(contractABI, contractAddress)
  const snapshot = await mintedBlockRef
    .where('monitorType', '==', 'createdForm')
    .limit(1)
    .get()

  const lastBlockDoc = snapshot.docs[0]

  const pastEvents = await smartContract.getPastEvents(
    'CreatedReviewForm',
    {},
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

const processRequestCreated = async startMintBlock => {
  const smartContract = new web3.eth.Contract(contractABI, contractAddress)
  const snapshot = await mintedBlockRef
    .where('monitorType', '==', 'createdRequest')
    .limit(1)
    .get()

  const lastBlockDoc = snapshot.docs[0]

  const pastEvents = await smartContract.getPastEvents(
    'CreatedReviewRequest',
    {},
    { fromBlock: startMintBlock, toBlock: 'latest' },
  )

  for (let i = 0; i < pastEvents.length; i++) {
    const requestName = pastEvents[i].returnValues._requestName
    const lastMintBlock = pastEvents[i].blockNumber
    const requestID = 0
    if (requestID > lastBlockDoc.data().lastRequestID) {
      const tx = pastEvents[i].transactionHash
      const reviewForm = await smartContract.methods
        .getRequest(requestName)
        .call()

      await writeRequestToDB(requestID, tx, reviewForm)

      await mintedBlockRef
        .doc(lastBlockDoc.id)
        .update({ lastFormID: parseInt(requestID) })
      await mintedBlockRef
        .doc(lastBlockDoc.id)
        .update({ lastSuccessTime: new Date() })
    }
    await mintedBlockRef
      .doc(lastBlockDoc.id)
      .update({ blockNumber: lastMintBlock })
  }
}

const monitorFormCreated = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '8GB',
  })
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    try {
      let lastMintBlock
      const snapshot = await mintedBlockRef
        .where('monitorType', '==', 'createdForm')
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
        !doc.data().mintsInProgress || // check if a mint is already in progress
        new Date() - doc.data().lastSuccessTime.toDate() > 540000 // go ahead and run if it's been 9 minutes since last successful run
      ) {
        await mintedBlockRef.doc(doc.id).update({ mintsInProgress: true })
        await processFormCreated(startMintBlock)
        await mintedBlockRef.doc(doc.id).update({ mintsInProgress: false })
        await mintedBlockRef.doc(doc.id).update({ lastSuccessTime: new Date() })
      }
    } catch (error) {
      functions.logger.error('[ !!! ] Error: ', error)
      throw new functions.https.HttpsError(error.code, error.message)
    }
  })

const monitorRequestCreated = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '8GB',
  })
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    try {
      let lastUpdateBlock
      const snapshot = await mintedBlockRef
        .where('monitorType', '==', 'createdRequest')
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
        !doc.data().updatesInProgress || // check if an update is already in progress
        new Date() - doc.data().lastSuccessTime.toDate() > 540000 // go ahead and run if it's been 9 minutes since last successful run
      ) {
        await mintedBlockRef.doc(doc.id).update({ updatesInProgress: true })
        await processRequestCreated(startUpdateBlock)
        await mintedBlockRef.doc(doc.id).update({ updatesInProgress: false })
        await mintedBlockRef.doc(doc.id).update({ lastSuccessTime: new Date() })
      }
    } catch (error) {
      functions.logger.error('[ !!! ] Error: ', error)
      throw new functions.https.HttpsError(error.code, error.message)
    }
  })

module.exports = {
  monitorFormCreated,
  monitorRequestCreated,
}
