var express         = require('express');

var mongo           = require('mongoskin'),
    db              = mongo.db("mongodb://localhost:27017/fitbit", {native_parser:true});


db.bind('keys');
db.bind('users');

