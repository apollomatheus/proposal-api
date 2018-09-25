const MongoClient    = require('mongodb').MongoClient;
const config = require('../config');

const db = {
    proposals: {
        limit: 0,
        result: [],
    },
    tasks: [],
    Connect(cb) {
        try {
            MongoClient.connect(config.url(), (err, database) => {
                if (err) throw err;
                cb({result: database });
            });
        } catch(err) {
            cb({error: 'MongoDB: Failed to connect!' });
        }
    },
    SetDefault() {
        this.proposals = {
            limit: 0,
            result: [],
        };
    },
    NewTask(scope,validator,callback) {
        var taskn = this.tasks.length; 
        this.tasks.push(setInterval(()=>{
            var object = validator(scope);
            if (object.done) {
                callback(object.element);
                clearInterval(this.tasks[taskn]);
            }
        },300));
    },
    GetProposals(database,cb) {
        this.SetDefault();
        try {
            var cl = database.collections('proposals');
            if (cl) {
                var cr = cl.find();
                cl.find().count((err,n)=>{
                    if (n > 0) {
                        //Elements count
                        this.proposals.limit = n; 

                        //Register task cycle
                        this.NewTask(this, (self)=>
                        {
                            if (self.proposals.limit == self.proposals.result.length) {
                                return { done: true, result: self.proposals.result };
                            }
                            return { done: false };
                        },cb);

                        //Iterate proposals elements
                        cr.each((err,item)=> {
                            if (err) throw err;
                            if (item) 
                            this.proposals.result.push({
                                id: this.proposals.result.length,
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

