const Alternative = require('./src/alternative')
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
const BASE_AMOUNT = 2;
const GRID_NUM = 10;
const BULL = true;
const BEAR = false;
const TAKE_PROFIT = 0.8 / 100;
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
const STRATEGY = -1;
const ENABLE_ASSIST_STRATEGY = false;
var direction;
var prevDirection;
var info = {
  centrePrice: 0,
  amount: 0,
  entryPrice: 0,
  threshold: 0,
  depth: 0,
  lastOrderPrice: 0,
};
var latestPrice = 0;
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
      if (info.centrePrice == 0 || info.centrePrice == undefined) {
        info.centrePrice = main_position.holdAvgPrice;
        info.amount = main_position.holdVol;
      }
      info.entryPrice = main_position.holdAvgPrice;
      // console.log(STRATEGY * (latestPrice - info.centrePrice), info.centrePrice * TAKE_PROFIT / GRID_NUM * (info.depth + 1));
      // console.log(1000 * STRATEGY * (latestPrice - info.centrePrice), 1000 * info.centrePrice * TAKE_PROFIT / GRID_NUM * (info.depth - 1));
      if (STRATEGY * (latestPrice - info.centrePrice) > info.centrePrice * TAKE_PROFIT / GRID_NUM * (info.depth + 1)) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: STRATEGY == 1 ? 4 : 2,
          vol: (info.depth == GRID_NUM - 1 ? main_position.holdVol : info.amount / GRID_NUM / 2).toFixed(0) * 1,
        });
        info.depth++;
        if (info.depth >= GRID_NUM) {
          info.depth = 0;
          info.centrePrice = 0;
          info.amount = 0;
        }
        action_tag = 1;
      }
      else if (STRATEGY * (latestPrice - info.centrePrice) < info.centrePrice * TAKE_PROFIT / GRID_NUM * (info.depth - 1)) {
        if (info.depth == -GRID_NUM) {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 4 : 2,
            vol: (main_position.holdVol).toFixed(0) * 1,
          });
          info.depth = 0;
          info.centrePrice = 0;
          info.amount = 0;
        }
        else {
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: STRATEGY == 1 ? 1 : 3,
            vol: (info.amount / GRID_NUM / 2).toFixed(0) * 1,
          });
          info.depth--;
        }
        action_tag = 1;
      }
    }
    else {
      if (direction == (STRATEGY == 1 ? BULL : BEAR)) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: STRATEGY == 1 ? 1 : 3,
          vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
        });
        info.depth = 0;
        info.centrePrice = 0;
        info.amount = 0;
        action_tag = 4;
      }
    }

    if (direction == (STRATEGY == 1 ? BEAR : BULL) && ENABLE_ASSIST_STRATEGY) {
      if (assist_position) {

      }
      else {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: STRATEGY == 1 ? 3 : 1,
          vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
          // stopLossPrice: latestPrice * (1 + TAKE_PROFIT / GRID_NUM),
        });
        action_tag = 5;
      }
    }
    else {
      if (assist_position) {
        action = await client.PlaceNewOrder({
          ...DEFAULT_OPTION,
          side: STRATEGY == 1 ? 2 : 4,
          vol: (assist_position.holdVol).toFixed(0) * 1,
        });
        action_tag = 6;
      }
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
  // console.log(indicator.periods[0], indicator.periods[1])
  const cur = indicator.periods[0].Smoothing_Line;
  const prev = indicator.periods[1].Smoothing_Line;
  if (cur > prev) direction = BULL;
  if (cur < prev * 0.99975) direction = BEAR;
  if (direction == undefined) direction = BULL;
  if (prevDirection != direction) {
    console.log('direction is changed from', prevDirection, 'to', direction, 'because of', cur, prev);
    displayCurrentBotStatus();
  }
  prevDirection = direction;
}

const displayCurrentBotStatus = () => {
  console.log(`V1.0 long Bot == eth => ${latestPrice?.toFixed(4)}$, entry => ${info.centrePrice?.toFixed(4)}, threshold is ${(info.centrePrice * (1 - STRATEGY * TAKE_PROFIT)).toFixed(4)}, ${(info.centrePrice * (1 + STRATEGY * TAKE_PROFIT)).toFixed(4)}, amount is ${info.amount}, depth is ${info.depth}, trend is ${direction}`);
}
info = readFromStorage('info');
tradingviewInit(main, setDirection);
setInterval(() => {
  displayCurrentBotStatus();
}, 60000);
setTimeout(() => {
  displayCurrentBotStatus();
}, 5000);