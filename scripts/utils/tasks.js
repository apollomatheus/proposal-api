'use strict';

class CTaskHandler {
    constructor(name,init) {
        this.name = name;
        this.$tasks = []; //each task
        if (init) {
          this.result = init(this);
        }
    }
    
    create(params,scope) {
      if (scope) {

        let interval = params.interval ? params.interval : 100;
        let tasknum = this.$tasks.length;

        this.$tasks.push({
           ready: false,
           taskNum: tasknum,
           events: [],
           eventsCallback: [],
           i: setInterval(()=>{
              if (scope(this,this.$tasks[tasknum])) {
                this.$tasks[tasknum].ready = true;
                clearInterval(this.$tasks[tasknum].i);
              } 
           },interval),
        });

        return tasknum;
      }
    }

    pipe(params) {
        try {
            this.Assert(params.tasknum);
            
            //default interval
            let interval = params.interval ? params.interval : 100;
            let tasknum = this.$tasks.length;
            
            //add event callbacks
            for (var n in params.events) {
                this.EventCallback(params.tasknum, n,  params.events[n]);
            }

            //add event listenners
            this.$tasks.push({
                ready: false,
                i: setInterval(()=>{
                    if (this.MatchEvents(params.tasknum,'ready') || this.$tasks[params.tasknum].ready) {
                        clearInterval(this.$tasks[tasknum].i);
                    }
                },interval),
            });

        } catch (e) {
            console.log('Invalid task');
        }
        
    }
    
    Assert(tasknum) {
        if (this.$tasks) {
            if (this.$tasks[tasknum]) {
                return;
            }
        }
        throw false;
    }

    DoEventCallback(tasknum,name,entry,verbose) {
        try {
            this.Assert(tasknum);
            if (this.$tasks[tasknum].eventsCallback[name]) {
                this.$tasks[tasknum].eventsCallback[name](entry);
            } else throw false;
        } catch (e) {
            if (verbose) console.log('Invalid task event callback ~> ',name);
        }
    }

    MatchEvents(tasknum,onQuit,verbose) {
        try {
            this.Assert(tasknum);
            var doQuit = false;
            for (var x in this.$tasks[tasknum].events) {
                //listenner quit event 
                if (x == onQuit) doQuit = true;
                else if (onQuit.length) {
                    for (var z in onQuit) {
                        var n = onQuit[z];
                        if (x == n) doQuit = true;
                    }
                }
                //callback
                this.DoEventCallback(tasknum,x,this.$tasks[tasknum].events[x],verbose);
            }
            return doQuit;
        } catch (e) {
            if (verbose) console.log('Invalid task event callback ~> ',name);
        }
        return false;
    }

    EventCallback(tasknum,name,callback) {
        try {
            this.Assert(tasknum);
            this.$tasks[tasknum].eventsCallback[name] = callback;
        } catch (e) {
            console.log('Invalid task to register event callback ~> ',name);
        }
    }

    Event(tasknum,name,result) {
        try {
            this.Assert(tasknum);
            this.$tasks[tasknum].events[name] = result;
        } catch (e) {
            console.log('Invalid task to register event callback ~> ',name);
        }
    }

    HasEvent(tasknum,name) {
        try {
            this.Assert(tasknum);
            for (var n in this.$tasks[tasknum].events) {
                if (n == name) {
                    return true;
                }
            }
        } catch (e) {
            console.log('Invalid task to register event callback1 ~> ',name);
        }
        return false;
    }
};

module.exports = {
    CTaskHandler,
};