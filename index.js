const express        = require('express');
const bodyParser     = require('body-parser');
const db             = require('./components/db');
const server         = require('./components/server');
const app            = express();
const port = 3080;

app.use(bodyParser.urlencoded({ extended: true }));
  
db.Connect((result)=>{
    try {
        if (result.error) throw result.error;

        server(app, result.result);
        app.listen(port, () => {
          console.log('We are live on ' + port);
        });
        
    } catch (err) {
        console.log('Error ~~> ', err);
    }
});