'use strict';

const config = require('../components/config');
const CTaskHandler = require('./utils/tasks').CTaskHandler;
const CRPC = require('./utils/rpc').CRPC;
const CMongo    = require('./utils/mongo').CMongo;

var rpc = {
    user: 'rpczzz',
    password: 'rpczzz',
    host: 'http://127.0.0.1:51314',
};

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
    date: null,
    budget: null,
    proposal: null,
    superblock: null
};

const TaskHandler = new CTaskHandler('taskhandler');
const Tasks = [];

var today = new Date();
var commonSuperblockInterval = DayTimeSpan(today, DateIncreased(today,(20160*90)));

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

    Tasks.push(new CRPC({
        request: options,
        events,
        tasks: TaskHandler,
        callback,
    }));
}

function DoMongo(db,events) {
    Tasks.push(new CMongo({
        db,
        events
    }));
}

function StoreStatus(database) {
    console.log('~~: Storing status!');
    var c = database.collection('status');
    c.insertOne(status, (err, res) => {
        if (err) throw err;
        console.log('~~: Stored!');
    });
}

function SaveStatus() {
    try {
        console.log('Saving status...');
        DoMongo(config, {
            onDatabase(v) {
                v.database.collection('status',(e,c)=>{
                    c.find().count((e,n)=>{
                        if (n > 0) {
                            v.database.dropCollection('status', function(err, ok) { 
                                if (err) throw err;
                                if (ok) {
                                    console.log('~~: Collection cleaned!');
                                    StoreStatus(v.database);
                                }
                                v.client.close();
                            });
                        } else {
                            console.log('~~: No clean needed!');
                            StoreStatus(v.database);
                            v.client.close();
                        }
                    })
                })
            }
        });
    } catch(err) {
        console.log('MongoDB: Failed to connect!');
    }
}

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
                    board.superblock = 'ok';
                    board.date = 'ok';
                },
                onError(e) {
                    console.log('Got error for governance info!');
                    board.superblock = 'error';
                    board.date = 'error';
                }
            }) 
        }
    },
    onError(e) {
        console.log('Failed to get wallet info.');
        board.superblock = 'error';
        board.date = 'error';
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

                board.proposal = 'ok';
                board.budget = 'ok';
            },
            onError(e) {
                console.log('Got error for proposals info!');
                board.proposal = 'error';
                board.budget = 'error';
            }
        });
    },
    onError(e) {
        console.log('Got error for masternode info!');
        board.proposal = 'error';
        board.budget = 'error';
    }
});


var watch = setInterval(()=>{
    if (board.date && board.budget && board.proposal && board.superblock) {
        if (board.date == 'ok' && board.budget == 'ok' && 
            board.proposal == 'ok' && board.superblock == 'ok') {
            SaveStatus();
        }
        clearInterval(watch);
    }
    
    if (board.date == 'error' || board.budget == 'error' || 
        board.proposal == 'error' || board.superblock == 'error') {
        console.log('Exit with error');
        clearInterval(watch);
    }
},100);