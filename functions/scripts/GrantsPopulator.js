const fs = require("fs");
const axios = require('axios');
const { db } = require('../firebase');
const { GRANTS_COLLECTION } = require('../constants/collections');

const grantsRef = db.collection(GRANTS_COLLECTION);
const inputFileName = "./scripts/grants.txt";

const writeGrantToDB = async (grantData) => {
  delete grantData.clr_prediction_curve;
  delete grantData.metadata.related;
  delete grantData.metadata.wall_of_love;
  delete grantData.active_round_names;

  const snapshot = await grantsRef
    .where('id', '==', parseInt(grantData.id))
    .limit(1)
    .get()

    if (snapshot.empty) {
      await grantsRef.add({
        ...grantData
      })
    } else {
      const document = grantsRef.doc(snapshot.docs[0].id)
      await document.update({
        ...grantData
      })
    }
}

async function addGrants () {
  const allFileContents = fs.readFileSync(inputFileName, 'utf-8');
  allFileContents.split(/\r?\n/).forEach(async (grantID) =>  {
    try {
      const grantData = await axios.get(`https://gitcoin.co/grants/v1/api/grant/${grantID}/`);
      if(grantData.data.grants){
        await writeGrantToDB(grantData.data.grants);
      }
    } catch(e) {
      console.log(e)
    }
  });
}

module.exports = {
  addGrants,
}