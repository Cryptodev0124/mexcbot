const analyze = require('tradingview-technical-analysis');const Alternative = require('../src/alternative')
const Future = require('./src/future')
require('dotenv').config()
const tradingviewInit = require('./src/helpers/tradingview');
const { writeToStorage, readFromStorage } = require('./src/helpers/fs');
const apiKey = process.env.API_KEY
const apiSecret = process.env.SECRET_KEY
const baseUrl = 'https://futures.mexc.com';
const client = new Alternative(process.env.AUTHORIZATION, apiSecret, { baseURL: baseUrl, isAlternative: true })
const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

const MARKET_SYMBOL = "DOGE_USDT";
const BASE_AMOUNT = 0.2;
const BULL = true;
const BEAR = false;
const BASE_AMOUNT_IN_USD = 10000;
const PRICE_DERIVATION = 1 / 100;
const TAKE_PROFIT = 0.5 / 100;
const MULTIPLIER = 5;
const INCREASE_FACTOR = 1.1;
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
const ENABLE_ASSIST_STRATEGY = false;
var info = {
  amount: 0,
  entryPrice: 0,
  threshold: 0,
  depth: 0,
  centrePrice: 0,
  profit: 0,
};
var latestPrice = 0;
var orderDepth = 0;
var isReady = true;
var leadLine1 = 0;
var leadLine2 = 0;
var ichimoku
var technical

const main = async (chart) => {
  // console.log(chart.periods[0])
  latestPrice = chart.periods[0].close;
  if (!isReady) return;
  isReady = false;
  const positions = await readClient.OpenPositions();
  const openOrders = await readClient.OpenOrders({symbol: "BNXNEW_USDT", page_num: 1, page_size: 20});
  console.log(positions.data.data);
  console.log(openOrders.data.data);
  return;
  const historyOrders = await readClient.HistoryOrders();
  var action;
  var action_tag = 0;
  if (positions.data.success) {
    const positions = positions.data.data;
    const orders = openOrders.data.data;
    const main_position = positions.filter(position => position.positionType == 1 && position.symbol == MARKET_SYMBOL)[0];
    const main_order = orders.filter(order => order.side == 1 && order.symbol == MARKET_SYMBOL)[0];
    // console.log(main_order, assist_order)
    // console.log(long_order)
    // console.log(positions);
    if (main_position) {
      if (info.entryPrice == 0) {
        info.entryPrice = main_position.holdAvgPrice;
        info.depth = 1;
      }
      info.centrePrice = main_position.holdAvgPrice;
      const realDepth = latestPrice - info.entryPrice / (info.entryPrice * PRICE_DERIVATION);
      if (latestPrice - main_position.holdAvgPrice > main_position.holdAvgPrice * TAKE_PROFIT) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 4,
          vol: (main_position.holdVol).toFixed(0) * 1,
        });
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 1,
          vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
        });
        info.depth = 0;
        info.amount = 0;
        info.entryPrice = 0;
        action_tag = 1;
      }
      else if (realDepth < -1 * info.depth) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: 1,
          vol: (BASE_AMOUNT / latestPrice * 100 * Math.pow(INCREASE_FACTOR, info.depth)).toFixed(0) * 1,
        });
        info.profit = 0;
        info.depth++;
        action_tag = 2;
      }
    }
    else {
      action = await client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 1,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
      });
      info.depth = 0;
      info.amount = 0;
      info.entryPrice = 0;
      action_tag = 4;
    }

    if (action != undefined) {
      console.log('================== CREATED NEW ORDER =================');
      console.log(action.data, action_tag);
      displayCurrentBotStatus();
      writeToStorage('info', info);
    }

  }
  isReady = true;
}

const setDirection = (indicator) => {
  console.log(indicator.periods[0])
}

const displayCurrentBotStatus = () => {
  if(technical == undefined) return;
  console.log(`V1.0 long Bot == eth => ${latestPrice?.toFixed(4)}$, entry => ${info.entryPrice?.toFixed(4)}, threshold is ${(info.entryPrice * (1 - PRICE_DERIVATION * info.depth)).toFixed(4)}, profit level is ${(info.centrePrice * (1 + STRATEGY * TAKE_PROFIT)).toFixed(4)}, depth is ${info.depth}, INDICATOR IS ${technical['Recommend.All']}, ${technical['Recommend.All']}, ${technical['Recommend.MA']}`);
}
info = readFromStorage('info');
tradingviewInit(main, setDirection);
setInterval(() => {
  displayCurrentBotStatus();
}, 10000);
setTimeout(() => {
  displayCurrentBotStatus();
}, 5000);