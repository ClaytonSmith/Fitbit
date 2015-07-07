
//document = [
//    {_id: XXX, name: ..., stuf: yyy, history: { today: {<>}, week: {<>}, month: {<>}}}
//]

// MongoDB-MongoSkin helper object. Grants access to mongoSkin middle-ware
var mongoDB =  require('mongoskin').ObjectID();


// add function go connect to fitbit 
function pullFitbitData(uID, uAK){
    console.log('Pulled user info from Fitbit Api.');
    
    return {};
}

exports.update = function(req, res, next){
    console.log('Updating database.');
    req.db.users.find().toArray( function(err, item){  
        res.json(item);
    });
}

// returns a list of users 
exports.info = function(req, res, next){
    console.log('Info is being requested.');
    res.json(exports.locals);
    res.end();
}

exports.addUserToGroup = function(req, res, next){      

    console.log( 'adding user to group', req.body );

    req.db.users.update({atc: req.body.user.atc},
                        {$set: {group: req.body.groupName}},
                        {multi: false},
                        function(err, obj){
                            console.log(err, obj);
                            res.send({message: 'User added to group. Go team'});
                            exports.sendUpdate();
                        });   
}

exports.getHistory = function(req, res, next){      
    console.log('User is being added.');
} 
