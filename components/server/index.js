const server = require('./server');

module.exports = function(app, database) {
    server(app, database);
};