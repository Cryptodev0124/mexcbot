const Alternative = require('./src/alternative')
const Future = require('./src/future')
const express = require('express')
const bodyParser = require('body-parser');
require('dotenv').config()
const tradingviewInit = require('./src/helpers/tradingview');
const { writeToStorage, readFromStorage } = require('./src/helpers/fs');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
const { filter } = require('bluebird');
const PORT = process.env.PORT || 5000;
const generateSignature = (queryString, secret) => {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Route to serve HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
app.post('/exchange', async (req, res) => {
  const { symbol, side, quantity, authorization, api_Key, secret_Key, leverage } = req.body;
  if (side === 100) {
    side = side * 98 / 100;
  }
  console.log("values", symbol, side, quantity, authorization, api_Key, secret_Key, leverage);
  const apiKey = process.env.API_KEY || api_Key;
  const apiSecret = process.env.SECRET_KEY || secret_Key;
  const baseUrl = 'https://futures.mexc.com';
  const client = new Alternative(process.env.AUTHORIZATION || authorization, apiSecret, { baseURL: baseUrl, isAlternative: true })
  const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

  var MARKET_SYMBOL = symbol;
  var priceSymbol = symbol.replace('_', '');
  var BASE_AMOUNT = 0;
  
  const LEAVERAGE_MULTIPLIER = leverage;
  const DEFAULT_OPTION = {
    symbol: MARKET_SYMBOL,
    openType: 2, // Cross Margin
    type: "5", // Market Order
    leverage: LEAVERAGE_MULTIPLIER,
    marketCeiling: false,
    priceProtect: "0",
    reduceOnly: true
  }
  
  var latest = 0;
  var isReady = true;

  const main = async () => {
    latest = await getLatestPrice(priceSymbol);
    var latestPrice = latest.price;
    console.log("latestPrice", latestPrice);
    const contractDetail = await client.ContractDetail();
    var maxVol = contractDetail.data.data.find(info => info.symbol === symbol).maxVol;
    var contractSize = contractDetail.data.data.find(info => info.symbol === symbol).contractSize;
    var maxAmount = maxVol * contractSize;
    console.log("maxAmount", maxAmount);
    const info = await readClient.AssetByCurrency({ currency: "USDT" });
    const availableBalance = info.data.data.availableBalance;
    console.log("availableBalance", availableBalance);
    const orderAmount = availableBalance * quantity * LEAVERAGE_MULTIPLIER / latestPrice / 100;

    console.log("quantity", quantity, orderAmount);

    if (orderAmount >= maxAmount) {
      BASE_AMOUNT = maxAmount;
    } else {
      BASE_AMOUNT = orderAmount;
    }
    if (!isReady) return;
    isReady = false;
    const result = await readClient.OpenPositions();
    var action;
    var action_tag = 0;
    console.log("success", result.data);
    if (result.data.success) {
      action = await client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: side,
        vol: ((BASE_AMOUNT / contractSize)).toFixed(0)
      });
      action_tag = 1;
      console.log('orderAmount', ((BASE_AMOUNT / contractSize)).toFixed(0))
      console.log("Created successful!", action.data);
      res.send(action.data)
    }
    isReady = true;
  }

  async function getLatestPrice(symbol) {
    try {
      const response = await axios.get(`https://api.mexc.com/api/v3/ticker/price`, {
        params: {
          symbol: symbol
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching price:', error);
      return null;
    }
  }

  info = readFromStorage('info');
  main();
});

app.post('/reverse', async (req, res) => {
  const { authorization, api_Key, secret_Key } = req.body;

  const apiKey = process.env.API_KEY || api_Key;
  const apiSecret = process.env.SECRET_KEY || secret_Key;
  const baseUrl = 'https://futures.mexc.com';
  const client = new Alternative(process.env.AUTHORIZATION || authorization, apiSecret, { baseURL: baseUrl, isAlternative: true })
  const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

  var isReady = true;

  const reverse = async () => {
    if (!isReady) return;
    isReady = false;
    const result = await readClient.OpenPositions();
    console.log("resultPosition", result.data);
    var action;
    var action_tag = 0;
    const symbol = result.data.data[0].symbol;
    var sideVol = result.data.data[0].positionType;
    const volume = result.data.data[0].holdVol;
    const leverage = result.data.data[0].leverage;
    
    console.log("getPositionResult", symbol, sideVol, volume, leverage);
    var MARKET_SYMBOL = symbol;
    const LEAVERAGE_MULTIPLIER = leverage;
    const DEFAULT_OPTION = {
      symbol: MARKET_SYMBOL,
      openType: 2, // Cross Margin
      type: "5", // Market Order
      leverage: LEAVERAGE_MULTIPLIER,
      marketCeiling: false,
      priceProtect: "0",
      reduceOnly: true
    }
    if (result.data.success) {
      if (sideVol === 1) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 4,
          vol: volume
        });
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 3,
          vol: volume
        });
        action_tag = 1;
        console.log("Reverse successful!", action.data);
        res.send(action.data)
      } else if (sideVol === 2) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 2,
          vol: volume
        });
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 1,
          vol: volume
        });
        action_tag = 1;
        console.log("Reverse successful!", action.data);
        res.send(action.data)
      }
    }
    isReady = true;
  }
  info = readFromStorage('info');
  reverse();
});

// app.post('/reverse', async (req, res) => {
//   console.log("here");
//   const { authorization, api_Key, secret_Key } = req.body;

//   const apiKey = process.env.API_KEY || api_Key;
//   const apiSecret = process.env.SECRET_KEY || secret_Key;
//   const baseUrl = 'https://futures.mexc.com';
//   const client = new Alternative(process.env.AUTHORIZATION || authorization, apiSecret, { baseURL: baseUrl, isAlternative: true })
//   const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

//   var isReady = true;

//   const reverse = async () => {
//     if (!isReady) return;
//     isReady = false;
//     const result = await readClient.OpenPositions();
//     console.log("openPosition", result);
//     var action;
//     var action_tag = 0;
//     console.log("success", result.data);
//     if (result.data.success) {
//       action = await client.Reverse({
//         positionId: result.data.data[0].positionId,
//         symbol: result.data.data[0].symbol,
//         positionType: result.data.data[0].positionType,
//         state: result.data.data[0].state,
//         leverage: result.data.data[0].leverage,
//       });
//       action_tag = 1;
//       console.log("Reverse successful!", action.data)
//       res.send(action.data)
//     }
//     isReady = true;
//   }
//   info = readFromStorage('info');
//   reverse();
// });
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
