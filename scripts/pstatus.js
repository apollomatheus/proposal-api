'use strict';

const Share = require('./share');

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
    success: false,
    error: false,
};

var today = new Date();
var commonSuperblockInterval = DayTimeSpan(today, DateIncreased(today,(20160*90)));

function SaveStatus() {
    try {
        console.log('Saving status...');
        
        var conf = Share.config;
        conf.collection = conf.c.status;

        Share.DoMongo(conf, {
            onDatabase(v,t) {
                var collection = v.collection ? v.collection : v.database.collection(conf.c.status);
                t.task.DoEventCallback(t.id,(collection ? 'count':'store'),v,false);
            } 
        }, {
            count(v,t) {
                var collection = v.collection ? v.collection : v.database.collection(conf.c.status);
                collection.find().count((e,n)=> {
                    if (n > 0) {
                        console.log('Cleaning...');
                        Share.DoMongoAction(v.database, 'drop', conf.c.status, (e,ok)=>{
                            t.task.DoEventCallback(t.id,'store',v,false);
                        });
                    } else {
                        t.task.DoEventCallback(t.id,'store',v,false);
                    }
                });
            },
            store(v) {
                console.log('Storing...');
                var collection = v.collection ? v.collection : v.database.collection(conf.c.status);
                collection.insertOne(status, (err, res) => {
                    if (err) throw err;
                    console.log('~~: Stored!');
                });
                v.client.close();
            },
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


function rpc(cmd,params,onReady,extra) {
    Share.rpc.$(Share, cmd, params, onReady, ()=>{
        console.log('Failed to get: ',cmd);
        board.error = true;
    },extra);
}

function SetGetInfo(callback) {
    rpc('getinfo',[],(v)=>{
        status.blocks = v.result.blocks;
        callback();
    });
}

function SetGovInfo(callback) {
    rpc('getgovernanceinfo',[],(v)=>{
        status.superblock.next = v.result.nextsuperblock;
        status.superblock.last = v.result.lastsuperblock;
        callback();
    });
}

function SetMnCount(callback) {
    rpc('masternode',['count'],(v)=>{
        status.masternodes = v.result;
        status.proposal.needVotes = v.result * 0.10;
        callback();
    });
}

function SetProposals(proposal) {
    var proposals = 0;
    var passing = 0;
    var insufficient = 0;
    var requested = 0;

    //calculate proposal info
    for (var x in proposal) {
        var p   = proposal[x];
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

    board.success = true;
}

function GetProposals() {
    rpc('gobject',['list'],(p)=>{
        SetGetInfo(()=>{
            SetGovInfo(()=>{
                SetMnCount(()=>{
                    CalculateNextSupertblock();
                    SetProposals(p.result);
                });
            });
        });
    });
}

//getinfo and governance status
console.log('Getinfo gathering...');
GetProposals();

var watch = setInterval(()=>{
    if (board.success) {
        SaveStatus();
        clearInterval(watch);
    }

    if (board.error) {
        console.log('Exit with error');
        clearInterval(watch);
    }
},100);