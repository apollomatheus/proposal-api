const MongoClient    = require('mongodb').MongoClient;
const config = require('../config').config;

const db = {
    tasks: [],
    Connect(cb) {
        try {
            MongoClient.connect(config.host, { useNewUrlParser: true }, (err, client) => {
                if (err) throw err;
                var database = client.db(config.database);
                cb({result: database });
            });
        } catch(err) {
            cb({error: 'MongoDB: Failed to connect!' });
        }
    },
    NewTask(scope,validator,callback) {
        var taskn = this.tasks.length; 
        this.tasks.push(setInterval(()=>{
            var object = validator(scope);
            if (object) {
                if (object.done) {
                    callback(object.result);
                    clearInterval(this.tasks[taskn]);
                }
            }
        },300));
    },
    GetStatus(database,cb) {
        try {
            var cl = database.collection(config.c.status);
            if (cl) {
                var done = false;
                var status = {};

                //Register task callback
                this.NewTask(this, (self) =>
                {
                    if (done) {
                        return { done: true, result: status };
                    }
                },cb);

                cl.find().count((err,n)=>{
                    if (n > 0) {
                        cl.find().forEach((item)=>{
                            if(!done) {
                            status = {
                            deadline: item.deadline,
                            date: item.date,
                            masternodes: item.masternodes,
                            blocks: item.blocks,
                            amount: item.budget,
                            proposal : item.proposal,
                            superblock: item.superblock,
                            };
                            done = true;
                            }
                        });
                    } else {
                        throw 'Status is empty.';
                    }
                });
            }  else {
                throw 'Status not found.';
            }
        } catch (err) {
            cb({error: err});
        }
    },
    GetProposals(database,cb) {
        try {
            var cl = database.collection(config.c.proposals);
            if (cl) {
                cl.find().count((err,n)=>{
                    if (n > 0) {
                        var proposals = [];

                        //Register task callback
                        this.NewTask(this, (self) =>
                        {
                            if (n == proposals.length) {
                                return { done: true, result: proposals };
                            }
                        },cb);

                        //fill proposals
                        cl.find().forEach((item)=> {
                            if (item) {
                                proposals.push({
                                    id: proposals.length,
                                    url: item.url,
                                    hash: item.hash,
                                    name: item.name,
                                    start: item.start,
                                    end: item.end,
                                    address: item.address,
                                    expired: item.expired,
                                    started: item.started,
                                    passing: item.passing,
                                    payments: item.payments,
                                    masternodes: item.masternodesEnabled,
                                    amount: {
                                        paid: item.estPaid,
                                        left: item.estPayLeft,
                                        total: item.totalPayment,
                                        available: item.allocated,
                                        unavailable: item.unallocated,
                                    },
                                    votes: {
                                        yes: item.voteYes,
                                        no: item.voteNo,
                                    },
                                }); 
                            }
                        });
                    } else {
                        throw 'Proposals empty';
                    }
                });
            } else {
                throw 'Proposals not found.';
            }
        } catch (err) {
            cb({error: err});
        }
    },
};

module.exports = db;

