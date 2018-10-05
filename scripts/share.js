'use strict';

const config_ = require('../components/config');
const CTaskHandler = require('./utils/tasks').CTaskHandler;
const CRPC = require('./utils/rpc').CRPC;
const CMongo    = require('./utils/mongo').CMongo;

const config = config_.config;
const rpc = config_.rpc;


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
            body: JSON.stringify( {"jsonrpc": "1.0", "id": "curlrpc", "method": method, "params": params })
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
        },callback));
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
        getblock(self,params,onReady,onError,onExtra) {
            self.DoRPC('getblock',params,{onReady, onError},onExtra);
        },
        getblockhash(self,params,onReady,onError,onExtra) {
            self.DoRPC('getblockhash',params,{onReady, onError},onExtra);
        },
        getblockheader(self,params,onReady,onError,onExtra) {
            self.DoRPC('getblockheader',params,{onReady, onError},onExtra);
        },
        gobject(self,params,onReady,onError,onExtra) {
            self.DoRPC('gobject',params,{onReady, onError},onExtra);
        },
        masternode(self,params,onReady,onError,onExtra) {
            self.DoRPC('masternode',params,{onReady, onError},onExtra);
        },
        decoderawtransaction(self,params,onReady,onError,onExtra) {
            self.DoRPC('decoderawtransaction',params,{onReady, onError},onExtra);
        },
        gettransaction(self,params,onReady,onError,onExtra) {
            self.DoRPC('gettransaction',params,{onReady, onError},onExtra);
        },
    }
}

module.exports = Share;