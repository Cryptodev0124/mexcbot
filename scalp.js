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
const BASE_AMOUNT = 0.02;
const BULL = true;
const BEAR = false;
const BASE_AMOUNT_IN_USD = 10000;
const PRICE_DERIVATION = 0.2 / 100;
const TAKE_PROFIT = 0.4 / 100;
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
var long_info = {
  amount: 0,
  entryPrice: 0,
  threshold: 0,
  depth: 0,
  lastOrderPrice: 0,
  started: false,
};
var short_info = {
  amount: 0,
  entryPrice: 0,
  threshold: 0,
  depth: 0,
  lastOrderPrice: 0,
  started: false,
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
    const long_position = positions.filter(position => position.positionType == 1 && position.symbol == MARKET_SYMBOL)[0];
    const short_position = positions.filter(position => position.positionType == 2 && position.symbol == MARKET_SYMBOL)[0];
    // const main_order = orders.filter(order => order.side == (STRATEGY == 1 ? 1 : 3) && order.symbol == MARKET_SYMBOL)[0];
    // const assist_order = orders.filter(order => order.side == (STRATEGY == 1 ? 3 : 1) && order.symbol == MARKET_SYMBOL)[0];
    // console.log(long_order, short_order)
    // console.log(long_order)
    // console.log(positions);
    // LONG
    if (long_position || short_position) {
      console.log('debug stage 1')
      if (long_position && short_position) {
        console.log('debug stage 2')
        if (latestPrice > long_position.holdAvgPrice * (1 + PRICE_DERIVATION)) {
          console.log('debug stage 3')
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 2,
            vol: short_position.holdVol,
          });
          long_info.threshold = latestPrice;
          action_tag = 1;
        }
        else if (latestPrice < short_position.holdAvgPrice * (1 - PRICE_DERIVATION)) {
          console.log('debug stage 4')
          action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 4,
            vol: long_position.holdVol,
          });
          short_info.threshold = latestPrice;
          action_tag = 2;
        }
      }
      else if (long_position) {
        console.log('debug stage 5')
        const closePosition = async () => {
          return action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 4,
            vol: long_position.holdVol,
          });
        }
        if (long_info.threshold > latestPrice) {
          action = await closePosition();
          action_tag = 3;
        }
        if(long_info.threshold * (1 + TAKE_PROFIT) < latestPrice) {
          long_info.started = true;
        }
        if((long_info.threshold * (1 + TAKE_PROFIT * 0.8) > latestPrice || direction == BEAR) && long_info.started) {
          action = await closePosition();
          action_tag = 4;
        }
        if(long_info.threshold < latestPrice && long_info.threshold * (1 + TAKE_PROFIT) > latestPrice && direction == BEAR) {
          action = await closePosition();
          action_tag = 5;
        }
      }
      else if (short_position) {
        console.log('debug stage 6')
        const closePosition = async () => {
          return action = await client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 2,
            vol: short_position.holdVol,
          });
        }
        if (short_info.threshold < latestPrice) {
          action = await closePosition();
          action_tag = 6;
        }
        if(short_info.threshold * (1 - TAKE_PROFIT) > latestPrice) {
          short_info.started = true;
          action_tag = 7;
        }
        if((short_info.threshold * (1 - TAKE_PROFIT * 0.8) < latestPrice || direction == BULL) && short_info.started) {
          action = await closePosition();
          action_tag = 8;
        }
      }
      else {

      }
    }
    else {
      action = await client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 3,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
        // stopLossPrice: info.entryPrice,
        // takeProfitPrice: info.entryPrice * (1 + -1 * STRATEGY * PRICE_DERIVATION)
      });
      action = await client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 1,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
      });
      action_tag = 4;
    }
    if (action != undefined) {
      console.log('================== CREATED NEW ORDER =================');
      // console.log(action.data, action_tag);
      displayCurrentBotStatus();
      writeToStorage('long', long_info);
      writeToStorage('short', short_info);
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
  // console.log(`V1.0 long Bot == eth => ${latestPrice?.toFixed(2)}$, entry => ${info.entryPrice?.toFixed(2)}, threshold is ${(info.entryPrice * (1 - STRATEGY * PRICE_DERIVATION)).toFixed(2)}, ${(info.entryPrice * (1 - STRATEGY * PRICE_DERIVATION / ASSIST_RATE)).toFixed(2)}, ${(info.entryPrice * (1 + STRATEGY * TAKE_PROFIT)).toFixed(2)}, amount is ${info.amount}, trend is ${direction}`);
  console.log('eth price', latestPrice, 'direction', direction);
  console.log(JSON.stringify(long_info));
  console.log(JSON.stringify(short_info));
}
long_info = readFromStorage('long') ?? {};
short_info = readFromStorage('short') ?? {};
tradingviewInit(main, setDirection);
setInterval(() => {
  displayCurrentBotStatus();
}, 60000);
setTimeout(() => {
  displayCurrentBotStatus();
}, 5000);