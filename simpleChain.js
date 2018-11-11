/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/
const SHA256 = require('crypto-js/sha256');

// Importing the module 'level'
const level = require('level');

// Declaring the folder path that store the data
const chainDB = './chaindata';
const db = level(chainDB);

// Delcraing folder path that contains the Block class
const Block = require('./Block.js');

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain {
    constructor() {
        this.chain = [];
        this.addNewBlock(new Block.Block("First block in the chain - Genesis block"));
    }

    // Add new block
    addNewBlock(newBlock) {
        let self = this;
        return new Promise(function(resolve, reject) {
            self.getBlockHeight().then(function(result) {
                newBlock.height = result;
                return self.getBlock(result - 1);
            }).then(function(result) {
                //check for genesis block
                if (result !== "") {
                    newBlock.previousBlockHash = result.hash;
                }
                newBlock.time = new Date().getTime().toString().slice(0, -3);
                newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
                let stringifiedObj = JSON.stringify(newBlock).toString();
                db.put(newBlock.height, stringifiedObj, function(err) {
                    if (err) {
                        console.log('Block ' + newBlock.height + ' submission failed', err);
                        reject(err);
                    }
                })
                resolve(stringifiedObj);
            })
        })
    }

    // Get block height
    getBlockHeight() {
        return new Promise(function(resolve, reject) {
            let i = 0;
            db.createReadStream().on('data', function() {
                i++;
            }).on('error', function(err) {
                console.log('Unable to read data stream!', err);
                reject(err);
            }).on('close', function() {
                console.log('Block #' + i);
                resolve(i);
            });
        });
    }

    // get block
    getBlock(blockHeight) {
        return new Promise(function(resolve, reject) {
            //only search db if not genesis block
            if (blockHeight > -1) {
                db.get(blockHeight, function(err, value) {
                    if (err) {
                        console.log('Not found!', err);
                        reject(err);
                    }
                    resolve(JSON.parse((value)));
                })
            } else {
                resolve("");
            }
        });
    };

    // validate block
    validateBlock(blockHeight) {
        let self = this;
        return new Promise(function(resolve) {
            self.getBlock(blockHeight).then(function(result) {
                let block = result;
                let blockHash = block.hash;
                block.hash = '';
                let validBlockHash = SHA256(JSON.stringify(block)).toString();
                // Compare
                if (blockHash === validBlockHash) {
                    resolve(true);
                } else {
                    resolve('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
                }
            })
        })
    }

    // Validate blockchain
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(function(resolve) {
            self.getBlockHeight().then(function(result) {
                var totalBlocks = result;
                let promises = [];
                let blockObj = [];
                for (var i = 0; i < totalBlocks; i++) {
                    promises.push(self.validateBlock(i));
                }
                for (var i = 0; i < totalBlocks; i++) {
                    blockObj.push(self.getBlock(i));
                }
                Promise.all(promises).then(function(results) {
                    for (var i = 0; i < results.length; i++) {
                        if (results[i] !== true) {
                            errorLog.push(results[i]);
                        }
                    }
                    Promise.all(blockObj).then(function(results) {
                        for (var i = 0; i < results.length - 1; i++) {
                            let blockHash = results[i].hash;
                            let previousHash = results[i + 1].previousBlockHash;
                            if (blockHash !== previousHash) {
                                errorLog.push("Previous Block Hash Of Block " + (i + 1) + " Does Not Match Hash Of Previous Block");
                            }
                        }
                        if (errorLog.length > 0) {
                            for (var i = 0; i < errorLog.length; i++) {
                                console.log(errorLog[i]);
                            }
                        } else {
                            console.log('No errors detected');
                        }
                        resolve();
                    });
                });
            })
        })
    }
}