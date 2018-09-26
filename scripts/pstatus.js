'use strict';

const request = require('request');
const MongoClient    = require('mongodb').MongoClient;
const config = require('../components/config');

var rpc = {
    user: 'rpc000u1',
    password: 'rpc000u2',
    host: 'http://127.0.0.1:51314',
};


class CTaskHandler {
    constructor(name,init) {
        this.name = name;
        this.$tasks = [];
        this.result = null;
        if (init) {
          this.result = init(this);
        }
    }
    
    addTask(params,scope) {
      if (scope) {
        let interval = params.interval ? params.interval : 100;
        let tasknum = this.$tasks.length;
        this.$tasks.push({
           ready: false,
           si: setInterval(()=>{
              var result = scope(this,tasknum);
              if (result) {
                 if (result == 'ready') {
                   this.$tasks[tasknum].ready = true;
                   clearInterval(this.$tasks[tasknum].si);
                 } 
              } 
           },interval),
        });
        return tasknum;
      }
    }

    addTaskListenner(params) {
        if (params.$tasks) {
            if (params.$tasks.length > params.tasknum && 
                params.tasknum >= 0 && params.$tasks.length > 0) {
                let interval = params.interval ? params.interval : 100;
                let tasknum = this.$tasks.length;
                this.$tasks.push({
                    ready: false,
                    si: setInterval(()=>{
                        if (params.$tasks[params.tasknum].ready) {
                            if (params.onready) params.onready(this);
                            this.$tasks[tasknum].ready = true;
                            clearInterval(this.$tasks[tasknum].si);
                        }
                        if (params.oncycle) params.oncycle(this);
                    },interval),
                });
            }
        }
    }

    addTaskResult(tasknum, result) {
        if (this.$tasks) {
            if (this.$tasks.length > tasknum && 
                tasknum >= 0 && this.$tasks.length > 0) {
                    this.$tasks[tasknum].result = result;
                }
        }
    }

    getTaskResult(tasknum) {
        if (this.$tasks) {
            if (this.$tasks.length > tasknum && 
                tasknum >= 0 && this.$tasks.length > 0) {
                    return this.$tasks[tasknum].result;
                }
        }
    }
};

const TaskHandler = new CTaskHandler('taskhandler');

function newTask(func,interval) {
    return TaskHandler.addTask({
        interval: interval ? interval: 100,
    },func);
}

function listenTask(tasknum,onready,oncycle,interval) {
    TaskHandler.addTaskListenner({
        tasknum,
        $tasks: TaskHandler.$tasks,
        onready: onready ? onready: null,
        oncycle: oncycle ? oncycle: null,
        interval: interval ? interval: 100,
    });
}

function rpcOptions(method,params) {
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

    return options;
}

function newRequest(options,callback) {
    try {
        //listen to request result
        var tasknum = newTask((self,tasknum)=>{
            var result = self.getTaskResult(tasknum);
            if (result) return 'ready';
        });
        
        //listen to task pulse
        listenTask(tasknum, (self) => {
            var result = self.getTaskResult(tasknum);
            callback(result);
        });

        //listen to request response
        request(options, (error,response, body) => {
            if (error) throw error;
            var result = JSON.parse(body);
            TaskHandler.addTaskResult(tasknum, result);
        });

    } catch(err) {
        console.log('Caught an error!');
    }
}


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

/* Get days in month */
function daysInMonth (month, year) {
    return new Date(year, month, 0).getDate();
}

/* Calculate day span between two dates */
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
    return { proposal: passing, requested, available, allocated: 100, unallocated: 10 };
}

function calcNextSuperblock(actualBlock,next) {
    var diffblock = next-actualBlock;//eg: 100-10 = 90
    var secs = Math.round(diffblock*90);//eg: block/sec
    var nextts = new Date();
    nextts.setTime(((nextts.getTime()/1000)+secs)*1000);
    return nextts;
}

//deadline - days
//masternodes - count
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

function getProposals() {
    
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
getProposals();
