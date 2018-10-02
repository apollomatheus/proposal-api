'use strict';

const CTaskHandler = require('./tasks').CTaskHandler
const MongoClient    = require('mongodb').MongoClient;

class CMongo {
    constructor(options,callback) {
        this._tasks = [];
        this._taskHandle = (options.tasks) ? options.tasks : new CTaskHandler('taskhandler');
        this.register(options);
    }


    //create task in handler
    __$newTask(func,interval) {
        return this._taskHandle.create({
            interval: interval ? interval: 100,
        },func);
    }

    //create task listenner in handler
    __$listenTask(tasknum,events,interval) {
        this._taskHandle.pipe({
            tasknum, 
            events
        });
    }

    //call http rpc as task
    __connect(options,events) {

        //for now, our task validate request result
        var tasknum = this.__$newTask((self,vtask)=>{
            var a = self.HasEvent(vtask.taskNum, 'client');
            var b = self.HasEvent(vtask.taskNum, 'error');
            if (a || b) return true; //finish
            return false; //continue
        });
        
        //listen to task pulses&events
        if (events) this.__$listenTask(tasknum, events);

        //handle connection
        MongoClient.connect(options.db.host, { useNewUrlParser: true }, (err, client) => {
            if (err) {
                this._taskHandle.Event(tasknum, 'error', err);
            } else {
                //if have database -- emit
                if (options.db.database) {
                    var database = client.db(options.db.database);
                    this._taskHandle.Event(tasknum, 'database', {database,client});
                }
                //emit final events
                this._taskHandle.Event(tasknum, 'client', client);
            }
        });

        return tasknum;
    }

    register(options) {
        if (options.db.host &&
            options.db.user &&
            options.db.password &&
            options.db.database &&
            (options.events || options.callback)) {
                this.$(options, options.events, options.callback);
            } else {
                console.log('Missing params for RPC task. {db:"", user:"", password:""}');
            }
    }

    $(options) {
        var onEvents = options.events;
        var events = [];
        events['client'] = onEvents.onConnect;
        events['database'] = onEvents.onDatabase;
        events['error'] = onEvents.onError;
        var tasknum = this.__connect(options,events);
        if (options.callback) options.callback(tasknum);
    }
}

module.exports = {
    CMongo,
};