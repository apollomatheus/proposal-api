const config = {
    host: 'localhost:27017',
    user: 'proposalApi',
    password: 'proposalApi',
    database: 'proposalApi',
    url () {
        return 'mongodb://'+this.user+':'+this.password+'@'+this.host+'/'+this.database;
    },
};

module.exports = config;