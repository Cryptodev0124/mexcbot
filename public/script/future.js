const Alternative = require('./src/alternative')
const Future = require('./src/future')
const express = require('express')
const bodyParser = require('body-parser');
require('dotenv').config()
const tradingviewInit = require('./src/helpers/tradingview');
const { writeToStorage, readFromStorage } = require('./src/helpers/fs');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Route to serve HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
app.post('/trade', async (req, res) => {
  alert("here");
  const { symbol, side, quantity } = req.body;
  console.log("values", symbol, side, quantity);
  const apiKey = process.env.API_KEY
  const apiSecret = process.env.SECRET_KEY
  const baseUrl = 'https://futures.mexc.com';
  const client = new Alternative(process.env.AUTHORIZATION, apiSecret, { baseURL: baseUrl, isAlternative: true })
  const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

  const MARKET_SYMBOL = symbol;
  const BASE_AMOUNT = 0.2;
  const BULL = true;
  const BEAR = false;
  const BASE_AMOUNT_IN_USD = 10000;
  const PRICE_DERIVATION = 0.5 / 100;
  const TAKE_PROFIT = 0.5 / 100;
  const ASSIST_RATE = 4;
  const INCREASE_FACTOR = 1.2;
  const LEAVERAGE_MULTIPLIER = 200;
  const DEFAULT_OPTION = {
    symbol: MARKET_SYMBOL,
    openType: 2, // Cross Margin
    type: "5", // Market Order
    leverage: LEAVERAGE_MULTIPLIER,
    marketCeiling: false,
    priceProtect: "0",
    reduceOnly: true
  }
  const STRATEGY = 1;
  var direction;
  var prevDirection;
  var info = {
    amount: 0,
    entryPrice: 0,
    threshold: 0,
    depth: 0,
    lastOrderPrice: 0,
  };
  var latestPrice = 0;
  var orderDepth = 0;
  var isReady = true;

  const main = async (chart) => {
    // console.log(chart.periods[0])
    latestPrice = chart.periods[0].close;
    if (!isReady) return;
    isReady = false;
    const res = await readClient.OpenPositions();
    // const history = await readClient.HistoryOrders();
    var action;
    var action_tag = 0;
    if (res.data.success) {
      const positions = res.data.data;
      // const orders = history.data.data;
      const main_position = positions.filter(position => position.positionType == (STRATEGY == 1 ? 1 : 2) && position.symbol == MARKET_SYMBOL)[0];
      const assist_position = positions.filter(position => position.positionType == (STRATEGY == 1 ? 2 : 1) && position.symbol == MARKET_SYMBOL)[0];
      // const main_order = orders.filter(order => order.side == (STRATEGY == 1 ? 1 : 3) && order.symbol == MARKET_SYMBOL)[0];
      // const assist_order = orders.filter(order => order.side == (STRATEGY == 1 ? 3 : 1) && order.symbol == MARKET_SYMBOL)[0];
      // console.log(long_order, short_order)
      // console.log(long_order)
      // console.log(positions);
      // LONG
      if (main_position) {
        info.entryPrice = main_position.holdAvgPrice;
        info.amount = main_position.holdVol;
        if (STRATEGY * (latestPrice - info.entryPrice) > info.entryPrice * TAKE_PROFIT) {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 4 : 2,
            vol: (info.amount).toFixed(0) * 1,
          });
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 1 : 3,
            vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
          });
          action_tag = 1;
        }
        else if (STRATEGY * (latestPrice - info.entryPrice) < -1 * info.entryPrice * PRICE_DERIVATION) {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 4 : 2,
            vol: (info.amount).toFixed(0) * 1,
          });
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 1 : 3,
            vol: (info.amount * INCREASE_FACTOR).toFixed(0) * 1,
          });

          if (assist_position) {
            action = await client.PlaceNewOrder({
              ...DEFAULT_OPTION,
              side: STRATEGY == 1 ? 2 : 4,
              vol: (assist_position.holdVol).toFixed(0) * 1,
            });
            console.log('closing assist position', action)
          }
          action_tag = 2;
        }
        else if (STRATEGY * (latestPrice - info.entryPrice) < -1 * info.entryPrice * PRICE_DERIVATION / ASSIST_RATE) {
          if (assist_position == undefined) {
            action = await client.PlaceNewOrder({
              ...DEFAULT_OPTION,
              side: STRATEGY == 1 ? 3 : 1,
              vol: info.amount,
              stopLossPrice: info.entryPrice,
              takeProfitPrice: info.entryPrice * (1 + -1 * STRATEGY * PRICE_DERIVATION)
            });
          }
          action_tag = 3;
        }
      }
      else {
        if (direction == STRATEGY == 1 ? BULL : BEAR) {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 1 : 3,
            vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
          });
          action_tag = 4;
        }

        if (assist_position) {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 2 : 4,
            vol: (assist_position.holdVol).toFixed(0) * 1,
          });
        }
      }
      if (assist_position) {
        if (direction == (STRATEGY == 1 ? BEAR : BULL)) {

        }
        else {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 2 : 4,
            vol: (assist_position.holdVol).toFixed(0) * 1,
          });
        }
      }
      if (action != undefined) {
        console.log('================== CREATED NEW ORDER =================');
        console.log(action.data, action_tag);
        if (action.data.message == "Request frequently too fast!" && action_tag == 2) {
          setTimeout(() => {
            if (assist_position) {
              client.PlaceNewOrder({
                ...DEFAULT_OPTION,
                side: STRATEGY == 1 ? 2 : 4,
                vol: (assist_position.holdVol).toFixed(0) * 1,
              });
            }
          }, 200);
        }
        displayCurrentBotStatus();
        writeToStorage('info', info);
      }

    }
    isReady = true;
  }

  const setDirection = (indicator) => {
    // console.log(indicator.periods[0], indicator.periods[1])
    const cur = indicator.periods[0].DEMA;
    const prev = indicator.periods[1].DEMA;
    if (cur > prev + 1) direction = BULL;
    if (cur < prev - 1) direction = BEAR;
    if (direction == undefined) direction = BULL;
    if (prevDirection != direction) {
      console.log('direction is changed from', prevDirection, 'to', direction, 'because of', cur, prev);
      displayCurrentBotStatus();
    }
    prevDirection = direction;
  }

  const displayCurrentBotStatus = () => {
    console.log(`V1.0 long Bot == eth => ${latestPrice?.toFixed(2)}$, entry => ${info.entryPrice?.toFixed(2)}, threshold is ${(info.entryPrice * (1 - STRATEGY * PRICE_DERIVATION)).toFixed(2)}, ${(info.entryPrice * (1 - STRATEGY * PRICE_DERIVATION / ASSIST_RATE)).toFixed(2)}, ${(info.entryPrice * (1 + STRATEGY * TAKE_PROFIT)).toFixed(2)}, amount is ${info.amount}, trend is ${direction}`);
  }
  info = readFromStorage('info');
  tradingviewInit(main, setDirection);
  setInterval(() => {
    displayCurrentBotStatus();
  }, 60000);
  setTimeout(() => {
    displayCurrentBotStatus();
  }, 5000);
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
