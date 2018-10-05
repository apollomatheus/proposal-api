'use strict';

const Share = require('./share');
const proposals = [];

var board = {
    proposals: false,
    error: false,
    blocks: 0,
    nextsuperblock: 0,
    masternodes: 0,
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


function SaveProposal() {
    var conf = Share.config;
    conf.collection = conf.c.proposals;

    Share.DoMongo(conf, {
        onDatabase(v,t) {
            var collection = v.collection ? v.collection : v.database.collection(conf.c.proposals);
            t.task.DoEventCallback(t.id,(collection ? 'count':'store'),v,false);
        },
        onError(v) {
            board.error = true;
        }
    }, {
        count(v,t) {
            var collection = v.collection ? v.collection : v.database.collection(conf.c.proposals);
            collection.find().count((e,n)=> {
                if (n > 0) {
                    console.log('Cleaning...');
                    Share.DoMongoAction(v.database, 'drop', conf.c.proposals, (e,ok)=>{
                        t.task.DoEventCallback(t.id,'store',v,false);
                    });
                } else {
                    t.task.DoEventCallback(t.id,'store',v,false);
                }
            });
        },
        store(v) {
            console.log('Storing...');
            var collection = v.collection ? v.collection : v.database.collection(conf.c.proposals);
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
        return { amount: total, blocks };
    }
    var amount = total / blocks;
    return { amount, blocks };
}

function ParseTransaction(hex, callback) {
    rpc('decoderawtransaction',[hex],(v)=>{
        callback(v.result);
    });
}

function CalculetePaidBlocks(address,callback,lowDate,highDate) {
    var payments = [];
    var sbi = 20160;

    for (var i = sbi; i < 161280+sbi; i+=sbi) {
        rpc('getblockhash',[i], (hash) => {
            rpc('getblock',[hash.result],(block)=> {

                if (lowDate || highDate) {
                    if (block.result.time < lowDate) {
                        return;
                    } 
                    if (block.result.time > highDate) {
                        return;
                    } 
                }

                var max = 0, count = 0;
                for (var n in block.result.tx) {
                    max++;
                }

                for (var n in block.result.tx) {
                    rpc('gettransaction',[block.result.tx[n]],(tx)=>{
                        ParseTransaction(tx.result.hex,(val)=>{
                            for (var v in val.vout) {
                                var addr = val.vout[v].scriptPubKey.addresses;
                                for (var a in addr) {
                                    if (addr[a] == address) {
                                        payments.push({amount: val.vout[v].value, block: block.result.height});
                                        break;
                                    }
                                }
                            }
                            count++;
                        });
                    });
                }

                //await payments to finish
                while(count < max) {
                    //...
                }
                callback(payments);
            });
        });
    }
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

function OrganizeProposal(value) {
    var ds_ = JSON.parse(value.DataString);
    var ds = ds_[0][1];

    //superblocks
    var LastDate = new Date(board.lastsuperblock_ts*1000);
    var NextDate = CalculateNextSupertblock(board.nextsuperblock,board.blocks);

    //proposal
    var Passing = ((value.AbsoluteYesCount-value.NoCount) > Math.round(board.masternodes*0.10));
    var Start = new Date(ds.start_epoch*1000);
    var End = new Date(ds.end_epoch*1000);

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
    var estPaid = Start < LastDate ? CalculatePayments(Start, LastDate, ds.payment_amount) : 0;
    var estLeft = today < End ? CalculatePayments(today, End, ds.payment_amount) : 0;
    var estTotalPaid = estPaid.amount && estPaid.blocks ? estPaid.amount * estPaid.blocks : 0;
    var estTotalLeft = estLeft.amount && estLeft.blocks ? estLeft.amount * estLeft.blocks : 0;
    var amount = (estLeft.amount ? estLeft.amount : ds.payment_amount);
    var allocated = 0;
    var unallocated = 0;

    if (!Expired && !NotStarted) {
        if (!Passing) {
            if (estTotalPaid >= ds.payment_amount) {
                estTotalPaid = 0;
            }
            unallocated = amount;
        } else {
            if (estTotalPaid >= ds.payment_amount) {
                estTotalPaid = 0;
            }
            allocated = amount;
        }
    }

    if (Expired) {
        estTotalPaid = ds.payment_amount;
    }

    if (NotStarted) {
        estTotalLeft = ds.payment_amount;
    }
    
    //calculate actual paid blocks
    CalculetePaidBlocks(ds.payment_address, (payments) => {
        proposals.push({
            hash: value.Hash,
            name: ds.name,
            url: ds.url,
            address: ds.payment_address,
            allocated: allocated,
            unallocated: unallocated,
            estPaid: estTotalPaid,
            estPayLeft: estTotalLeft,
            payments,
            totalPayment: ds.payment_amount,
            masternodesEnabled: board.masternodes,
            passing: Passing,
            voteYes: value.YesCount,
            voteNo: value.NoCount,
            voteAbs: value.AbstainCount,
            funding: value.fCachedFunding,
            deleted: value.fCachedDelete,
            start: ds.start_epoch,
            end: ds.end_epoch,
            expired: Expired,
            started: !NotStarted,
        });
    })
    
}

function SetMnCount(callback) {
    console.log('Reading wallet info...')
    rpc('masternode',['count'],(v)=>{
        board.masternodes = v.result;
        callback();
    });
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
            SetMnCount(()=>{
            SetGovernanceInfo(()=>{
                SetLastSuperblock(()=>{
                    if (l.result) t.task.DoEventCallback(t.id,'list',l.result,false);
                    else console.log('Empty response');
                    board.proposals = true;
                })
            })
        })
        })
    },{
        list(v) {
            console.log('Parsing proposals...')
            for (var p in v) {
                OrganizeProposal(v[p]);
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
