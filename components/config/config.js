const config = {
    host: 'mongodb://localhost:27017',
    user: 'papi',
    password: 'papi',
    database: 'proposalApi',
    c: {
        status: 'status',
        proposals: 'proposals',
    }
};

const rpc = {
    user: '',
    password: '',
    host: 'http://127.0.0.1:51314'
};

module.exports = {
    config,
    rpc
}