
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
    
    req.db.users.find().forEach( function(user){
	// pull and replace
    });
}

// returns a list of users 
exports.info = function(req, res, next){
    console.log('Info is being requested.');

    req.db.users.find().toArray( function(err, item){  
	res.json(item);	    
    });
};

exports.addUser = function(req, res, next){      
    console.log('User is being added.');
    
    // TODO: refine thing
    req.db.keys.insert( req.body, { w: 0 });
    
    
    // Get user data 
    // update db  
    req.db.users.insert( pullFitbitData(userData), { w: 0 });    
    

    // Send user their data
    res.json( { success: 'user added'} );	    	    
} 
