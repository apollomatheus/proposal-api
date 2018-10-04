'use strict';

const Share = require('./share');
const proposals = [];

var board = {
    proposals: false,
    error: false,
    blocks: 0,
    nextsuperblock: 0,
};


var today = new Date();
var commonSuperblockInterval = DayTimeSpan(today, DateIncreased(today,(20160*90)));


function DateIncreased(date,sec) {
    date.setTime(((date.getTime()/1000)+sec)*1000);
    return date;
 }

// 
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

// interval 20160 --
var superblock = [
    20160,40320,
    60480,80640,100800,
    120960,141120,161280,181440,
    201600,221760,241920,262080,282240,
    302400,322560,342720,362880,383040,403200,
];

var secByDay = (24*60*60);

// get superblocks between two dates
function CalculateSuperblocksBetween(dateA,dateB) {
    var blocks = 0;
    var da = dateA;
    var db = dateB;

    //get array of blocks between DA and DB
    while (da.getTime() <= db.getTime()) {
            blocks += 1;
            //block interval
            da = DateIncreased(da,secByDay*commonSuperblockInterval);
    }
    return blocks;
}

// from here we can get the next superblock, but its not exact
function CalculateNextSupertblock(next,actual) {
    var diffblock = next - actual;
    var secs = Math.round(diffblock*90);//90s per block
    var next = new Date();
    
    var nd = new Date(next.setTime(((next.getTime()/1000)+secs)*1000));//forward time

    return nd;
}

// divide payments through specified interval
function CalculatePayments(start,end,total) {
    var blocks = CalculateSuperblocksBetween(start,end);
    if (blocks == 0) {
        return { unallocated: total, blocks };
    }
    var amount = total / blocks;
    return { amount, blocks };
}

function CompareDate(da,db) {
    if (da.getFullYear() <= db.getFullYear()) {
        //low year
        if (da.getFullYear() < db.getFullYear()) {
            return true;
        }
        if (da.getMonth() <= db.getMonth()) {
            //low month
            if (da.getMonth() < db.getMonth()) {
                return true;
            }
            return (da.getDate() <= db.getDate());
        } 
    } 
    return false;
}

function OrganizeProposal(value,masternodes) {
    var ds_ = JSON.parse(value.DataString);
    var ds = ds_[0][1];

    //superblocks
    var LastDate = new Date(board.lastsuperblock_ts*1000);
    var NextDate = CalculateNextSupertblock(board.nextsuperblock,board.blocks);

    //proposal
    var Passing = ((value.AbsoluteYesCount-value.NoCount) > Math.round(masternodes*0.10));
    var Start = new Date(ds.start_epoch*1000);
    var End = new Date(ds.end_epoch*1000);

    var Paid = Start < LastDate ? CalculatePayments(Start, LastDate, ds.payment_amount) : 0;
    var Left = today < End ? CalculatePayments(today, End, ds.payment_amount) : 0;

    var Expired = false;
    var NotStarted = false;

    if (today.getDate() < Start.getDate() &&
        today.getMonth() <= Start.getMonth() &&
        today.getFullYear() <= Start.getFullYear()) {
            NotStarted = true;
    }

    if (!NotStarted) {
        var now = new Date();
        if (CompareDate(now,End)) {
            if (CompareDate(NextDate,End)) {
                Expired = false;
            } else {
                Expired = true;
            }
        } else {
            Expired = true;
        }
    }

    //estimative to pay, left to pay, amount per month, budget allocation...
    var estTotalPaid = Paid.amount && Paid.blocks ? Paid.amount * Paid.blocks : 0;
    var estTotalLeft = Left.amount && Left.blocks ? Left.amount * Left.blocks : 0;
    var amount = (Paid.amount ? Paid.amount : (Left.amount ? Left.amount : ds.payment_amount));
    var allocated = 0;
    var unallocated = 0;

    if (!Expired && !NotStarted) {
        if (!Passing) {
            unallocated = amount;
        } else {
            allocated = amount;
        }
    }

    proposals.push({
        hash: value.Hash,
        name: ds.name,
        url: ds.url,
        address: ds.payment_address,
        allocated: Expired || NotStarted ? 0 : allocated,
        unallocated: Expired || NotStarted ? 0 : unallocated,
        estPaid: Expired || NotStarted ? 0 : estTotalPaid,
        estPayLeft: Expired || NotStarted ? 0 : estTotalLeft,
        requestPayment: ds.payment_amount,
        masternodesEnabled: masternodes,
        passing: Passing,
        voteYes: value.YesCount,
        voteNo: value.NoCount,
        voteAbs: value.AbstainCount,
        funding: value.fCachedFunding,
        deleted: value.fCachedDelete,
        start: ds.start_epoch,
        end: ds.end_epoch,
        expired: Expired,
        started: NotStarted,
    });
    
}

function SaveProposal() {
    var conf = Share.config;
    conf.collection = 'proposals';

    Share.DoMongo(conf, {
        onDatabase(v,t) {
            var collection = v.collection ? v.collection : v.database.collection('proposals');
            t.task.DoEventCallback(t.id,(collection ? 'count':'store'),v,false);
        },
        onError(v) {
            board.error = true;
        }
    }, {
        count(v,t) {
            var collection = v.collection ? v.collection : v.database.collection('proposals');
            collection.find().count((e,n)=> {
                if (n > 0) {
                    console.log('Cleaning...');
                    Share.DoMongoAction(v.database, 'drop', 'proposals', (e,ok)=>{
                        t.task.DoEventCallback(t.id,'store',v,false);
                    });
                } else {
                    t.task.DoEventCallback(t.id,'store',v,false);
                }
            });
        },
        store(v) {
            console.log('Storing...');
            var collection = v.collection ? v.collection : v.database.collection('proposals');
            collection.insertOne({proposals}, (err, res) => {
                if (err) throw err;
                console.log('Stored!');
            });
            v.client.close();
        },
    });
}

function rpc(cmd,params,onReady,extra) {
    Share.rpc.$(Share, cmd, params, onReady, ()=>{
        console.log('Failed to get:',cmd);
        board.error = true;
    },extra);
}

function SetGetInfo(callback) {
    console.log('Reading wallet info...')
    rpc('getinfo',[],(v)=>{
        board.blocks = v.result.blocks;
        callback();
    });
}

function SetGovernanceInfo(callback) {
    console.log('Reading governance info...')
    rpc('getgovernanceinfo',[],(v)=>{
        board.lastsuperblock = v.result.lastsuperblock;
        board.nextsuperblock = v.result.nextsuperblock;
        callback();
    });
}

function SetLastSuperblock(callback) {
    console.log('Reading last superblock hash...')
    rpc('getblockhash',[board.lastsuperblock],(v)=>{
        rpc('getblockheader',[v.result],(vn)=>{
            board.lastsuperblock_ts = vn.result.time;
            callback();
        })
    });
}

function SetProposals() {
    rpc('gobject',['list'],(l,t)=>{
        SetGetInfo(()=>{
            SetGovernanceInfo(()=>{
                SetLastSuperblock(()=>{
                    if (l.result) t.task.DoEventCallback(t.id,'list',l.result,false);
                    else console.log('Empty response');
                    board.proposals = true;
                })
            })
        })
    },{
        list(v) {
            console.log('Parsing proposals...')
            for (var p in v) {
                OrganizeProposal(v[p], 10);
            }
            console.log('Saving proposals...')
            SaveProposal();
        }
    });
}

var watch = setInterval(()=>{
    if (board.proposals || board.error) {
        console.log(proposals);
        console.log('All done... exit:',board.error ? 'error':'success');
        clearInterval(watch);
    }
},100);

SetProposals();

