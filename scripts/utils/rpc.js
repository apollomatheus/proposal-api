'use strict';

const CTaskHandler = require('./tasks').CTaskHandler
const request = require('request')

class CRPC {
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
    __$listenTask(tasknum,taskevent,interval) {
        this._taskHandle.pipe({
            tasknum,
            onready: taskevent ? (taskevent.onReady ? taskevent.onReady: null) : null,
            onerror: taskevent ? (taskevent.onError ? taskevent.onError: null) : null,
            oncycle: taskevent ? (taskevent.onCycle ? taskevent.onCycle: null) : null,
            interval: interval ? interval: 100,
        });
    }

    //call http rpc as task
    __http(options,task) {

        //for now, our task validate request result
        var tasknum = this.__$newTask((self,vtask)=>{
            var a = self.HasEvent(vtask.taskNum, 'ready');
            var b = self.HasEvent(vtask.taskNum, 'error');
            if (a || b) return true; //finish
            return false; //continue
        });
        
        //listen to task pulses&events
        if (task) this.__$listenTask(tasknum, task);

        //handle request
        request(options.request, (error,response, body) => {
            if (error) {
                this._taskHandle.Event(tasknum, 'error', error);
            } else if (response) {
                if (response.statusCode != 200)  {
                    this._taskHandle.Event(tasknum, 'error', 'Got error status from RPC.');
                }
            }
            if (body) {
                var result = JSON.parse(body);
                this._taskHandle.Event(tasknum, 'ready', result);
            }
        });

        return tasknum;
    }

    register(options) {
        if (options.request.url &&
            options.request.method &&
            options.request.body &&
            (options.events || options.callback)) {
                this.$(options, options.events, options.callback);
            } else {
                console.log('Missing params for RPC task.');
            }
    }

    $(options) {
        var onEvents = options.events;
        var task = {
            onReady: (onEvents ? (onEvents.onReady ? onEvents.onReady : null) : null),
            onError: (onEvents ? (onEvents.onError ? onEvents.onError : null) : null),
            onEvent: (onEvents ? (onEvents.onEvent ? onEvents.onEvent : null) : null),
        };
        var tasknum = this.__http(options,task);
        if (options.callback) options.callback(tasknum);
    }
}

module.exports = {
    CRPC,
};