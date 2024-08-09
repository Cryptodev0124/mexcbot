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
  console.log("testingnow", req.body);
  const { symbol, side, quantity, authorization, api_Key, secret_Key, leverage } = req.body;
  if (quantity === 100) {
    quantity = quantity * 98 / 100;
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
    const orderBalance = availableBalance * LEAVERAGE_MULTIPLIER;
    const maxBalance = Math.min(maxAmount * latestPrice, orderBalance);
    const orderAmount = maxBalance * quantity / latestPrice / 100;

    console.log("quantity", quantity, orderAmount);

    const result = await readClient.OpenPositions();
    
    if ((side == 1) || (side == 3)) {
      console.log("longPosition");
      BASE_AMOUNT = orderAmount;
    } else if ((side == 2) || (side == 4)) {
      console.log("shortPosition");
      if (result.data.data) {
        console.log("base3", (result.data.data[0].holdVol * quantity / 100));
        BASE_AMOUNT = (result.data.data[0].holdVol * quantity / 100);
      } else {
        console.log("base4");
        res.send(result.data.data)
        BASE_AMOUNT = 0;
        return false
      }
    }
    console.log("baseAmount", side, orderAmount, BASE_AMOUNT);
    if (!isReady) return;
    isReady = false;
    var action;
    var action_tag = 0;
    console.log("success", result.data);
    if (result.data.success) {
      if ((side == 1) || (side == 3)) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: side,
          vol: ((BASE_AMOUNT / contractSize)).toFixed(0)
        });
      } else if (side == 4) {
        console.log(result.data.data[0].holdVol);
        console.log(((BASE_AMOUNT)).toFixed(0))
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 4,
          vol: ((BASE_AMOUNT)).toFixed(0)
        });
        // action = await client.PlaceNewOrder({
        //   ...DEFAULT_OPTION,
        //   side: 1,
        //   vol: (((result.data.data[0].holdVol * (100 - quantity) / 100).toFixed(1) / contractSize)).toFixed(0)
        // });
        action_tag = 1;
      } else if (side == 2) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 2,
          vol: ((BASE_AMOUNT)).toFixed(0)
        });
        // action = await client.PlaceNewOrder({
        //   ...DEFAULT_OPTION,
        //   side: 3,
        //   vol: (((result.data.data[0].holdVol * (100 - quantity) / 100).toFixed(1) / contractSize)).toFixed(0)
        // });
        action_tag = 2;
      }
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
    if (!result.data.data.length) {
      res.send(result.data.data)
      return false
    }
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

app.post('/sellAll', async (req, res) => {
  const { authorization, api_Key, secret_Key } = req.body;

  const apiKey = process.env.API_KEY || api_Key;
  const apiSecret = process.env.SECRET_KEY || secret_Key;
  const baseUrl = 'https://futures.mexc.com';
  const client = new Alternative(process.env.AUTHORIZATION || authorization, apiSecret, { baseURL: baseUrl, isAlternative: true })
  const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

  var isReady = true;

  const sellAll = async () => {
    if (!isReady) return;
    isReady = false;
    const result = await readClient.OpenPositions();
    console.log("resultPosition", result.data);
    var action;
    var action_tag = 0;
    if (!result.data.data.length) {
      res.send(result.data.data)
      return false
    }
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
        action_tag = 1;
        console.log("Closed successful!", action.data);
        res.send(action.data)
      } else if (sideVol === 2) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 2,
          vol: volume
        });
        action_tag = 1;
        console.log("Closed successful!", action.data);
        res.send(action.data)
      }
      // action = await client.CancelAll();
      console.log("Closed successful!", action.data);
    }
    isReady = true;
  }
  info = readFromStorage('info');
  sellAll();
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
