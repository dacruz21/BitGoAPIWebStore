(function() {
    'use strict'
    
    const config = {
        // Minimum block confirmations before a transaction is considered secure
        minConfirmations: {
            btc: 2,     // block time = 10 minutes
            eth: 12,    // block time = 18 seconds
            xrp: 0,     // N/A
            bch: 2,     // block time = 10 minutes
            ltc: 8,      // block time = 2.5 minutes


            // TESTNET
            tbtc: 1,     // block time = 10 minutes
            teth: 12,    // block time = 18 seconds
            txrp: 0,     // N/A
            tbch: 2,     // block time = 10 minutes
            tltc: 8      // block time = 2.5 minutes
        }
    }

    module.exports = config
})()