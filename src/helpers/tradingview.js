const TradingView = require("@mathieuc/tradingview");

const init = (chartCallback, indicatorCallback) => {
    // Init Tradinvview chart
    const tradingviewClient = new TradingView.Client({
        token: '9pqho8st4hywlau4grmgzfgown35016a',
        signature: 'v1:SIYChkLZYSrK592VRv0TVHvQTQZZgmdmGpAPu6NirCA='
    }); // Creates a websocket client
    const chart = new tradingviewClient.Session.Chart(); // Init a Chart session
    chart.setMarket('MEXC:PEPEUSDT.P', { // Set the market
        timeframe: '15',
        range: 1000
    });
    console.log("chart", chart.infos.description);

    const INDICATOR_NAME = "DCA Bot Emulation Indicator";
    
    TradingView.getPrivateIndicators('9pqho8st4hywlau4grmgzfgown35016a').then((rs) => {
    // TradingView.searchIndicator('ichimoku').then((rs) => {
        rs.forEach(async (indic) => {
            if (indic.name !== INDICATOR_NAME)
                return
            console.log('indicator found')
            const privateIndic = await indic.get()
            // privateIndic.setOption('Source', 'close');
            // privateIndic.setOption('Length', 3);
            const indicator = new chart.Study(privateIndic)
            indicator.onReady(() => console.log(`${INDICATOR_NAME} IS READY :)`))
            
            indicator.onUpdate(() => {
                indicatorCallback(indicator);
            })
        });
    });



    chart.onError((...err) => { // Listen for errors (can avoid crash)
        console.error('Chart error:', ...err);
        // Do something...
    });

    chart.onSymbolLoaded(() => { // When the symbol is successfully loaded
        console.log(`Market "${chart.infos.description}" loaded !`);
    });

    chart.onUpdate(() => { // When price changes
        if (!chart.periods[0]) return;
        chartCallback(chart);
    });

}
module.exports = init