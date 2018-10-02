'use strict';

const MongoClient    = require('mongodb').MongoClient;
const config = require('../components/config');
const CTaskHandler = require('./utils/tasks').CTaskHandler;
const CRPC = require('./utils/rpc').CRPC;

const TaskHandler = new CTaskHandler('taskhandler');
const RPCHandler = [];

var rpc = {
    user: 'rpczzz',
    password: 'rpczzz',
    host: 'http://127.0.0.1:51314',
};

function DoRPC(method,params,events,callback) {
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
        body: JSON.stringify( {"jsonrpc": "1.0", "id": "curltest", "method": method, "params": params })
    };

    RPCHandler.push(new CRPC({
        request: options,
        events,
        tasks: TaskHandler,
        callback,
    }));
}

/*
function storeStatus(database,status) {
    console.log('Storing status!');
    var c = database.collection('status');
    c.insertOne(status, (err, res) => {
        if (err) throw err;
        console.log('OK!');
    });
}

function saveStatus(status) {
    if (!status) return;
    try {
        MongoClient.connect(config.host, { useNewUrlParser: true }, (err, client) => {
            if (err) throw err;

            var database = client.db(config.database);
            console.log('Database connected!');

            database.collection('status',(err,c) => {
                c.find().count((err,n) => {
                    if (n > 0) { //clean collection
                        database.dropCollection('status', function(err, delOK) { 
                            if (err) throw err;
                            console.log('Collection cleaned!');
                            storeStatus(database,status);
                            client.close();
                        });
                    } else {
                        storeStatus(database,status);
                        client.close();
                    }
                });
            });
        });
    } catch(err) {
        console.log('MongoDB: Failed to connect!');
    }
}

/* Get days in month 
function daysInMonth (month, year) {
    return new Date(year, month, 0).getDate();
}

/* Calculate day span between two dates 
function daySpan(dateA,dateB) {
    var days = 0;
    var today = new Date();
    for (var y = dateA.getFullYear(); y < dateB.getFullYear()+1; y++) {
        for (var m = dateA.getMonth(); m < dateB.getMonth()+1; m++) {
            var d = daysInMonth(m,y);
            var dm = (today.getMonth() == m) ? d-today.getDate() : d;
            var dmB = (dateB.getMonth() == m) ? dateB.getDate() : dm;
            days += dmB;
        }
    }
    return days;
}

function budgetRequest() {
    return 100;
}

function budgetPassing() {
    var passing = 100;
    var insufficient = 10;
    return { passing, insufficient };
}

function budgetAllocation() {
    var superblockRwd = ((20160*10) * 0.10);
    var passing = budgetPassing();
    var requested = budgetRequest();
    var available = superblockRwd - requested;
    console.log(available);
    return { proposal: passing, requested, available, allocated: 100, unallocated: 10 };
}

function calcNextSuperblock(actualBlock,next) {
    var diffblock = next-actualBlock;//eg: 100-10 = 90
    var secs = Math.round(diffblock*90);//eg: block/sec
    var nextts = new Date();
    nextts.setTime(((nextts.getTime()/1000)+secs)*1000);
    return nextts;
}

function organizeStatus(actualBlock,next) {
    var today = new Date();
    var date = calcNextSuperblock(actualBlock,next);
    var budget = budgetAllocation();
    
    var dayspan = daySpan(today,date)-1;
    return {
        day: date.getDate(),
        month: date.getMonth()+1,
        year: date.getFullYear(),
        deadline: dayspan,//days
        masternodes: 100,
        budget };
}

function getStatus() {
    
    console.log('Getting status from RPC...');

    newRequest(rpcOptions('getgovernanceinfo',[]), (result) => {
        console.log('Got result ! (getgovernanceinfo)');
        var info = result.result;
        var nextSuperBlock = info.nextsuperblock;

        newRequest(rpcOptions('getinfo',[]), (result) => {
            var info2 = result.result;
            var actualBlock = info2.blocks;

            var status = organizeStatus(actualBlock, nextSuperBlock);
            saveStatus(status);
        });

    });
}

//--init
getStatus();*/

const status = {
    deadline: -1,
    date: {
        day: 0,
        month: 0,
        year: 0,
    },
    budget: {
        requested: 0, 
        available: ((20160*10)*0.10), 
        allocated: 0, 
        unallocated: 0,
    },
    proposal: {
        total: 0,
        needVotes: 0,
        passing: 0,
        insufficient: 0,
        expired: 0,
        notStarted: 0,
    },
    superblock: {
        last: 0,
        next: 0,
    },
    blocks: 0,
    masternodes: 0,
};

var board = {
    date: false,
    budget: false,
    proposal: false,
    superblock: false
};

var today = new Date();
var commonSuperblockInterval = DayTimeSpan(today, DateIncreased(today,(20160*90)));

function DateIncreased(date,sec) {
   date.setTime(((date.getTime()/1000)+sec)*1000);
   return date;
}

function DayTimeSpan(dateA,dateB) {
    var days = 0;
    for (var y = dateA.getFullYear(); y < dateB.getFullYear()+1; y++) {
        for (var m = dateA.getMonth(); m < dateB.getMonth()+1; m++) {
            var d = new Date(y, m, 0).getDate(); // days in month
            var dm = (today.getMonth() == m) ? d-today.getDate() : d;
            var dmB = (dateB.getMonth() == m) ? dateB.getDate() : dm;
            days += dmB;
        }
    }
    return days;
}

// from here we can get the next superblock, but its not exact
function CalculateNextSupertblock() {
    var diffblock = status.superblock.next - status.blocks;
    var secs = Math.round(diffblock*90);//90s per block
    var next = new Date();
    
    var nd = new Date(next.setTime(((next.getTime()/1000)+secs)*1000));//forward time
    var dayspan = DayTimeSpan(today,nd)-1;

    status.deadline = dayspan;
    status.date.day = next.getDate();
    status.date.month = next.getMonth()+1;
    status.date.year = next.getFullYear();
}

// get superblocks between two dates
function CalculateSuperblocksBetween(dateA,dateB) {
    var interval = DayTimeSpan(dateA,dateB);
    var blocks = Math.round(commonSuperblockInterval / interval);
    if (blocks < 1) return 1;
    return blocks;
}

// update available budget
function CalculateBudgetAvailable(amount,pass) {
    if (status.budget.available && pass) {
        status.budget.allocated += amount;
        status.budget.available -= status.budget.requested;
    } else {
        status.budget.unallocated += amount;
    }
}

// divide payments through specified interval
function CalculatePaymentPerMonth(ts,te,total,pass) {
    var start = new Date(ts*1000);
    var end = new Date(te*1000);
    var blocks = CalculateSuperblocksBetween(start,end);
    var amount = total / blocks;

    //check if we are inside proposal budget date
    if ((today.getDate() >= start.getDate()) &&
        (today.getDate() < end.getDate()) &&
        (today.getMonth() >= start.getMonth()) &&
        (today.getMonth() < end.getMonth()) && 
        (today.getFullYear() >= start.getFullYear()) &&
        (today.getFullYear() <= end.getFullYear())) {
        status.budget.requested += amount;
        CalculateBudgetAvailable(amount,pass);
    } else {
        // not started
        if ((today.getDate() < start.getDate()) &&  //not today
            (today.getMonth() < start.getMonth()) && //not this month
            (today.getFullYear() < start.getFullYear())) //not this year 
        {
            status.proposal.notStarted +=1;
        // expired
        } else if  ((today.getDate() > end.getDate()) &&  //not today
                    (today.getMonth() > end.getMonth()) && //not this month
                    (today.getFullYear() > end.getFullYear())) //not this year 
        {
            status.proposal.expired +=1;
        } else {
            status.budget.unallocated += amount;
        }
    }
}

// parse date string to array
function DateStringParse(ds) {
    var values = [];
    for (var n in ds) {
        var x = ds[n];
        for (var y in x) {
            for (var z in x[y]) {
               values[z] = (x[y])[z];
            }
        }
    }
    return values;
}


//getinfo and governance status
console.log('~~: Getinfo gathering...');
DoRPC('getinfo',[],{
    onReady(gi) {
        status.blocks = gi.result.blocks;
        if (status.blocks) {
            console.log('~~: Getinfo OK...');
            console.log('~~: Governance gathering...');
            DoRPC('getgovernanceinfo',[],{
                onReady(v) {
                    console.log('~~: Governance OK...');
                    status.superblock.next = v.result.nextsuperblock;
                    status.superblock.last = v.result.lastsuperblock;
                    CalculateNextSupertblock();
                    board.superblock = true;
                    board.date = true;
                },
                onError(e) {
                    console.log('Got error for governance info!');
                }
            }) 
        }
    },
    onError(e) {
        console.log('Failed to get wallet info.');
    }
});

//masternode info
console.log('~~: Masternodes gathering...');
DoRPC('masternode',['count'],{
    onReady(v) {
        status.masternodes = v.result;
        status.proposal.needVotes = v.result * 0.10;

        console.log('~~: Masternodes OK...');
        console.log('~~: Proposals gathering...');
        //proposals info
        DoRPC('gobject',['list'],{
            onReady(v) {
                console.log('~~: Proposals OK...');
                
                var proposals = 0;
                var passing = 0;
                var insufficient = 0;
                var requested = 0;

                //calculate proposal info
                for (var x in v.result) {
                    var p   = v.result[x];
                    var yes = p.YesCount;
                    var no  = p.NoCount;
                    var ds = DateStringParse(JSON.parse(p.DataString));
                    var pass = (yes-no >= status.proposal.needVotes);

                    if (pass) passing++;
                    else insufficient++;

                    CalculatePaymentPerMonth(
                        ds['start_epoch'],
                        ds['end_epoch'],
                        ds['payment_amount'], pass);
                    
                    proposals++;
                }
                
                status.budget.requested = requested;

                status.proposal.total = proposals;
                status.proposal.passing = passing;
                status.proposal.insufficient = insufficient;

                board.proposal = true;
                board.budget = true;
            },
            onError(e) {
                console.log('Got error for proposals info!');
            }
        });
    },
    onError(e) {
        console.log('Got error for masternode info!');
    }
});


var watch = setInterval(()=>{
    if (board.date && board.budget && board.proposal && board.superblock) {
        console.log('Task ended!');
        console.log(status);
        clearInterval(watch);
    }
});