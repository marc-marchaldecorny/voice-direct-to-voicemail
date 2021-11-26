const express = require('express');
const app = express();
require('dotenv').config();

app.use(express.json());

console.log("starting express ")
const VONAGE_API_KEY = process.env.VONAGE_API_KEY
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET
const VONAGE_APPLICATION_ID = process.env.VONAGE_APPLICATION_ID
const VONAGE_APPLICATION_PRIVATE_KEY_PATH = __dirname + "/" + process.env.VONAGE_APPLICATION_PRIVATE_KEY_PATH
var numberInsightResult ={};

const Vonage = require('@vonage/server-sdk');



app
  .route('/sendVoicemail')
  .post(handleVoicemailSendRequest)

async function handleVoicemailSendRequest(request, response) {
  const params = Object.assign(request.query, request.body)
  console.log(params)
  const callConfig = getCallConfig();
  const vonage = new Vonage({
    apiKey: VONAGE_API_KEY,
    apiSecret: VONAGE_API_SECRET,
    applicationId: VONAGE_APPLICATION_ID,
    privateKey: VONAGE_APPLICATION_PRIVATE_KEY_PATH
  });
  DESTINATION_NUMBER = params.phonenumber;
  ORIGINATION_NUMBER = params.originphonenumber;
  VOICE_FILE = params.voicefile;
  // Resquest to identify current carrier

  let makeCall = await new Promise(resolve => {
  vonage.numberInsight.get({level: 'advancedSync', number: DESTINATION_NUMBER}, (error, result) => {
    if(error) {
      console.error(error);
      resolve(false);
    }
    else {

      console.log(result);
      numberInsightResult = result;

      if( checkSupportedCarrier(callConfig,numberInsightResult.current_carrier.network_code) )
      {
          console.log("valid carrier - initiating voicecall") 
          resolve(true);
          

      }
      else{
        console.log("unsupported operator") 
          resolve(false);
      }
    }
  });
  })

  if (makeCall == true)
  {
    // retrieve config
    let NCCO = retrieveCallConfigJSON(callConfig,numberInsightResult,ORIGINATION_NUMBER,VOICE_FILE) 
    // make call
    //vonage.calls.create(NCCO);
    // send response
    response.status(200).send({status: 1, message: "success"})
  }
  else
  {
    error_msg = "unsupported mobile operator : "+numberInsightResult.current_carrier.network_code;
    response.status(200).send({status: 0, message: error_msg})
  }

  
}


function checkSupportedCarrier(callConfig,network_code) 
{
    console.log(callConfig) 
      if( typeof callConfig[network_code] !== 'undefined' )
      {
        // network is supported for voicemail drop  
        return true
      }
      else
      {
        // network is NOT supported for voicemail drop    
        return false
      }

}

function retrieveCallConfigJSON(callConfig,numberInsightResult,ORIGINATION_NUMBER,VOICE_FILE) 
{

  network_code = numberInsightResult.current_carrier.network_code
  phonenumberNatl = numberInsightResult.national_format_number
  // remove spaces
  phonenumberNatl=phonenumberNatl.replaceAll(' ','')

  TO_NUMBER = callConfig[network_code].voicemailLVN
  console.log(phonenumberNatl)
  DIGIT_SEQUENCE = callConfig[network_code].digitSequence
  // replace with phone number
  DIGIT_SEQUENCE=DIGIT_SEQUENCE.replaceAll('%phonenumberNatl%',phonenumberNatl)

  ncco = {
    "to": [ 
            {
              "type": "phone",
              "number": TO_NUMBER,
              "dtmfAnswer": DIGIT_SEQUENCE
            } 
          ],
    "from": {
          "type": "phone",
          "number": ORIGINATION_NUMBER
          },
    "ncco": [
      {
        "action": "record",
        "eventUrl": ["https://mdecorny.nexmodemo.com/event_voice.php"]
      },
      {
      "action": "stream",
      "streamUrl": [VOICE_FILE]
    }
  ]} 

  console.log(JSON.stringify(ncco))
  return ncco

}

function getCallConfig()
{
  // p = 500ms
  let callConfig = {
    "20801": { "operatorName": "Orange", "voicemailLVN": "33680808080", "digitSequence":"pp%phonenumberNatl%#pppppppppp1pp#" },
    "20810": { "operatorName": "SFR", "voicemailLVN": "33610001000", "digitSequence":"pp%phonenumberNatl%#pppppppppppppp#pp*" },
    "20820": { "operatorName": "Bouygues Telecom", "voicemailLVN": "33660660001", "digitSequence":"pp%phonenumberNatl%#pppppppppppppp#pp*" }
    //"20810": { "voicemailLVN": "33609222291", "digitSequence":"pppppppppp%phonenumberNatl%#pp" }
  }

  return callConfig;
}

app.listen(process.env.SERVER_PORT || 3000)