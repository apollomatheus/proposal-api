const server = require('./server');

module.exports = function(app, database,db) {
    server(app, database,db);
};