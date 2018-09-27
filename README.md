# Proposal Rest API

Simple API for governance proposal dashboard app.

# Setup

To install make sure you have **nodejs >= 4.0**

```
npm install
npm start
```

# Scripts

In order to update proposals, add to **crontab** or run:
```
nodejs scripts/psync.js
```

For status update, add to **crontab** or run:
```
nodejs scripts/pstatus.js
```