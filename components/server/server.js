
module.exports = function(app, database){

    app.get('/proposals', (req,res) => {
        res.send({
            proposals: [
                {
                  index: '1',
                  hash: 'abcdefghijklmnopqrstuvxwyz1234567890',
                  name: 'Proposal test',
                  url: 'http://www.internet.com',
                  amount: {
                    payment: {
                      paid: 1,
                      total: 5,
                    },
                    request: 10.00,
                    available: 2.00,
                  },
                  masternodes: 120,
                  votes: {
                    yes: 100,
                    no: 20,
                  }
                },
            ],
        });
    });

    app.get('/status', (req,res) => {
        res.send({
            status: {
                deadline: 5,
                masternodes: 120,
                amount: {
                  available: 2048,
                  requested: 110,
                  allocated: 100,
                  unallocated: 1948,
                },
                proposal: {
                  passing: 2,
                  insufficient: 1,
                }
            }
        });
    });

};