'use strict';

const config = require('../components/config');
const CTaskHandler = require('./utils/tasks').CTaskHandler;
const CRPC = require('./utils/rpc').CRPC;
const CMongo    = require('./utils/mongo').CMongo;

var rpc = {
    user: 'rpczzz',
    password: 'rpczzz',
    host: 'http://127.0.0.1:51314',
};

const TaskHandler = new CTaskHandler('taskhandler');
const Tasks = [];

const Share = {
    config,
    DoRPC(method,params,events,actions,callback) {
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
    
        Tasks.push(new CRPC({
            request: options,
            events,
            tasks: TaskHandler,
            actions,
            callback,
        }));
    }, 
    DoMongo(db,events,actions) {
        Tasks.push(new CMongo({
            db,
            events,
            actions
        }));
    },
    DoMongoAction(db,action,collection,callback) {
        Tasks.push(new CMongo({
            database:db,
            action,
            collection
        },callback))
    },
    rpc: {
        $(self,name,params,onReady,onError,onExtra) {
            var func = null;
            for (var n in self.rpc) {
                if (n == name) {
                    func = self.rpc[n];
                    break;
                }
            }
            if (func) func(self,params,onReady,onError,onExtra);
        },
        getinfo(self,params,onReady,onError,onExtra) {
            self.DoRPC('getinfo',params,{onReady, onError},onExtra);
        },
        getgovernanceinfo(self,params,onReady,onError,onExtra) {
            self.DoRPC('getgovernanceinfo',params,{onReady, onError},onExtra);
        },
        getblockhash(self,params,onReady,onError,onExtra) {
            self.DoRPC('getblockhash',params,{onReady, onError},onExtra);
        },
        getblockheader(self,params,onReady,onError,onExtra) {
            self.DoRPC('getblockheader',params,{onReady, onError},onExtra);
        },
        gobject(self,params,onReady,onError,onExtra) {
            self.DoRPC('gobject',params,{onReady, onError},onExtra);
        }

    }
}

module.exports = Share;