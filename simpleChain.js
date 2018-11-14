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
        let self = this;
        this.getBlockHeight().then(function(result) {
            //chain is empty if result is 0, therefore add genesis block
            if (result === -1) {
                self.addBlock(new Block.Block("First block in the chain - Genesis block"));
            }
        })
    }

    // Add new block
    addBlock(newBlock) {
        let self = this;
        return new Promise(function(resolve, reject) {
            self.getBlockHeight().then(function(result) {
                newBlock.height = result + 1;
                //get previous block for previousHash
                return self.getBlock(result);
            }).then(function(result) {
                //don't assign previousHash if genesis block
                if (result !== 0) {
                    newBlock.previousBlockHash = result.hash;
                }
                //get current time
                newBlock.time = new Date().getTime().toString().slice(0, -3);
                //make hash of object
                newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
                //make string of object to write to database
                let stringifiedObj = JSON.stringify(newBlock).toString();
                db.put(newBlock.height, stringifiedObj, function(err) {
                    if (err) {
                        console.log('Block ' + newBlock.height + ' submission failed', err);
                        reject(err);
                    }
                })
                resolve(stringifiedObj);
            }).catch(() => {
                console.log("Unable To Add Block");
            })
        })
    }

    // Get block height
    getBlockHeight() {
        let self = this;
        return new Promise(function(resolve, reject) {
            let i = -1;
            db.createReadStream().on('data', function() {
                i++;
            }).on('error', function(err) {
                console.log('Unable to read data stream!', err);
                reject(err);
            }).on('close', function() {
                self.getBlock(i).then(function(result) {
                    if (result === 0) {
                        resolve(-1);
                    } else {
                        resolve(result.height);
                    }
                })
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
                    } else {
                        resolve(JSON.parse((value)));
                    }
                })
            } else {
                resolve(0);
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
        let validateBlockErrorLog = [];
        let internalErrorLog = [];
        return new Promise(function(resolve) {
            self.getBlockHeight().then(function(result) {
                var totalBlocks = result;
                let promises = [];
                let blockObj = [];
                for (var i = 0; i < totalBlocks + 1; i++) {
                    promises.push(self.validateBlock(i));
                }
                for (var i = 0; i < totalBlocks + 1; i++) {
                    blockObj.push(self.getBlock(i));
                }
                Promise.all(promises).then(function(results) {
                    for (var i = 0; i < results.length; i++) {
                        if (results[i] !== true) {
                            validateBlockErrorLog.push(results[i]);
                        }
                    }
                    if (validateBlockErrorLog.length > 0) {
                        console.log(validateBlockErrorLog.length + " Error(s) Detected");
                        for (var i = 0; i < validateBlockErrorLog.length; i++) {
                            console.log(validateBlockErrorLog[i]);
                        }
                    }

                    Promise.all(blockObj).then(function(results) {
                        for (var i = 0; i < results.length - 1; i++) {
                            let blockHash = results[i].hash;
                            let previousHash = results[i + 1].previousBlockHash;
                            if (blockHash !== previousHash) {
                                internalErrorLog.push("Previous Block Hash Of Block " + (i + 1) + " Does Not Match Hash Of Previous Block");
                            }
                        }
                        if (internalErrorLog.length > 0) {
                            for (var i = 0; i < internalErrorLog.length; i++) {
                                console.log(internalErrorLog[i]);
                            }
                        } else if (internalErrorLog.length === 0) {
                            console.log('No errors detected');
                        }
                        resolve();
                    });
                });
            })
        })
    }
}