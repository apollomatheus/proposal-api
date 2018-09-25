'use strict';

const request = require('request');
const MongoClient    = require('mongodb').MongoClient;
const config = require('../components/config');

var rpc = {
    user: 'rpc000u1',
    password: 'rpc000u2',
    host: 'http://127.0.0.1:51314',
};

var proposals = [];

function storeProposal(c) {
    console.log('Storing proposals!');
    //add items
    for (let i = 0; i < proposals.length; i++) {
        c.insertOne(proposals[i], (err, res)=> {
            if (err) throw err;
            console.log('Proposal added!');
        });
    }
}

function saveProposals() {
    try {
        MongoClient.connect(config.url(), (err, database) => {
            if (err) throw err;
            console.log('Database connected!');
            var coll = database.getCollection('proposals');
            coll.find().count((err,n) => {
                if (n > 0) { //clean collection
                    database.dropCollection('proposals', function(err, delOK) { 
                        if (err) throw err;
                        console.log('Collection cleaned!');
                        //recreate
                        database.createCollection('proposals', function(err, res) {
                            if (err) throw err;
                            var c = database.getCollection('proposals');
                            storeProposal(c);
                        });
                    });
                } else {
                    storeProposal(coll);
                }
            });
            database.close();
        });
    } catch(err) {
        console.log('MongoDB: Failed to connect!');
    }
}

function masternodeCount() {
    return 100;
}

function organizeProposal(value) {
    var ds = JSON.parse(value.DataString);
    var mc = masternodeCount();
    var p = {
        hash: value.Hash,
        name: ds.name,
        url: ds.url,
        address: ds.payment_address,
        paid: 0,
        totalPayment: 1,
        availablePayment: 1,
        requestPayment: ds.payment_amount,
        masternodesEnabled: mc,
        voteYes: value.YesCount,
        voteNo: value.NoCount,
        voteAbs: value.AbstainCount,
        funding: value.fCachedFunding,
        deleted: value.fCachedDelete,
        start: ds.start_epoch,
        end: ds.end_epoch,
    };
    return p;
}

function getProposals() {
    let options = {
        url: rpc.host,
        method: "post",
        headers:
        {
         "content-type": "text/plain"
        },
        auth: {
            user: rpc.user,
            pass: rpc.password
        },
        body: JSON.stringify( {"jsonrpc": "1.0", "id": "curltest", "method": "gobject", "params": ["list"] })
    };
    
    console.log('Getting proposals from RPC...');
    request(options, (error, response, body) => {
        if (error) {
            throw error;
        } else {
            var result = JSON.parse(body);
            if (result.error) throw result.error;
            else {
                var list = result.result;
                for (var hash in list) {
                    var p = organizeProposal(list[hash]);
                    proposals.push(p);
                }
                saveProposals();
            }
        }
    });
}

//--init
getProposals();
