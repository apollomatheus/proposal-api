const MongoClient    = require('mongodb').MongoClient;
const config = require('../config');

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
            var cl = database.collection('status');
            if (cl) {
                var done = false;
                var status = {};

                //Register task cycle
                this.NewTask(this, (self) =>
                {
                    if (done) {
                        return { done: true, result: status };
                    }
                },cb);

                cl.find().forEach((item)=>{
                    if(!done) {
                     status = {
                       deadline: item.deadline,
                       date: {
                           day: item.day,
                           month: item.month,
                           year: item.year,
                       },
                       masternodes: item.masternodes,
                       amount: {
                            available: item.budget.available,
                            requested: item.budget.requested,
                            allocated: item.budget.allocated,
                            unallocated: item.budget.unallocated,
                       },
                       proposal : {
                           passing: item.budget.proposal.passing,
                           insufficient: item.budget.proposal.insufficient,
                       }
                     };
                     done = true;
                    }
                });
            }
        } catch (err) {
            cb({error: err});
        }
    },
    GetProposals(database,cb) {

        try {
            var cl = database.collection('proposals');
            if (cl) {
                cl.find().count((err,n)=>{
                    if (n > 0) {
                        var proposals = [];

                        //Register task cycle
                        this.NewTask(this, (self) =>
                        {
                            if (n == proposals.length) {
                                return { done: true, result: proposals };
                            }
                        },cb);

                        //Iterate proposals elements
                        cl.find().forEach((item)=> {
                            if (item) {
                                proposals.push({
                                    id: proposals.length,
                                    name: item.name,
                                    hash: item.hash,
                                    url: item.url,
                                    amount: {
                                        payment: { 
                                            paid: item.paid,
                                            total: item.totalPayment,
                                        },
                                        request: item.requestPayment,
                                        available: item.availablePayment,
                                    },
                                    masternodes: item.masternodesEnabled,
                                    votes: {
                                        yes: item.voteYes,
                                        no: item.voteNo,
                                    }
                                }); 
                            }
                        });
                    } else {
                        throw 'Proposals empty';
                    }
                });
            }
        } catch (err) {
            cb({error: err});
        }
    },
};

module.exports = db;

