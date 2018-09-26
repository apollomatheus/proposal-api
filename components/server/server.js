var cors = require('cors');

module.exports = function(app, database, db){
    app.use(cors({origin: '*'}));

    app.get('/proposals', (req,res) => {
        db.GetProposals(database, (result) => {
            res.send({ proposals: result });
        });
    });

    app.get('/status', (req,res) => {
        db.GetStatus(database, (result) => {
            res.send({ status: result });
        });
    });

};