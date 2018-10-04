'use strict';

const CTaskHandler = require('./tasks').CTaskHandler
const MongoClient    = require('mongodb').MongoClient;

class CMongo {
    constructor(options,callback) {
        if (options.database && options.action && options.collection) {
            if (!callback) return 'Missing callback';
            this.__$performAction(options,callback);
        } else {
            this._tasks = [];
            this._taskHandle = (options.tasks) ? options.tasks : new CTaskHandler('taskhandler');
            this.register(options);
        }
    }


    __$performAction(options,callback) {
        if (options.database && options.action && options.collection && callback) {
            switch(options.action) {
                case 'drop':
                    options.database.dropDatabase(options.collection,(e,dok)=>{
                        callback(e,dok);
                    });
                break;

                default:
                break;
            }
        }
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
                    var collection = null;
                    var database = client.db(options.db.database);
                    if (options.db.collection) {
                        collection = database.collection(options.db.collection);
                    }
                    this._taskHandle.Event(tasknum, 'database', {database,client,collection});
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
                console.log('Missing params for MONGO task.');
            }
    }

    $(options) {
        var onEvents = options.events;
        var events = [];
        events['client'] = onEvents.onConnect;
        events['collection'] = onEvents.onCollection;
        events['database'] = onEvents.onDatabase;
        events['error'] = onEvents.onError;

        //extra action
        var onActions = options.actions;
        for (var n in onActions) {
            events[n] = onActions[n];
        }

        var tasknum = this.__connect(options,events);
        if (options.callback) options.callback(tasknum);
    }
}

module.exports = {
    CMongo,
};