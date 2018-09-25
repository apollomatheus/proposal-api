const config = {
    host: 'localhost:27017',
    user: 'papi',
    password: 'papi',
    database: 'proposalApi',
    url () {
        return 'mongodb://'+this.user+':'+this.password+'@'+this.host+'/'+this.database;
    },
};

module.exports = config;