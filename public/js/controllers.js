'use strict';


/*
  user schema = {
  id:  object // method 1 of identifacation 
  atc:  num // method 2 of identifacation 
  group: string // may or may not exist. not part of group if exist. 
  color: hex string // user display color
  distance: int // current daily distance
  distances: [] // running total of todays distances
  }


  history schema = {
  id:  object // method 1 of identifacation 
  atc:  int // method 2 of identifacation 
  records: [
  {},
  {},
  {}, 
  {} ...
  ]
  }

  record schema = {
  date: object // date of record 
  settings: object // server settings for that day (like time scale)
  distance: int // distance for the day
  distances: [] // distances for the day
  }
*/



// Helper function 
Array.prototype.insert = function (index, item) {
    this.splice(index, 0, item);
};

// Tests to see if an object is empty.
function isEmptyObject(obj){
    for(var propName in obj){
        if(obj.hasOwnProperty(propName)){
            return false;
        }
    }
    return true;
}

// Helper function
// Returns a true if a list contains an element.
function include(arr,obj) {
    return (arr.indexOf(obj) != -1);
}

/******** CONTROLLERS ********/
function appCtrl($scope, $http, $location, $rootScope){
    console.log('Hello from app controller.');
}


/* Controllers */
function mapCtrl($scope, $http, $location, $rootScope, $filter, getInfo, $fancyModal, $anchorScroll){
    $rootScope.appData = getInfo.getData();    

    var cloudLockLogo = "http://icons.iconarchive.com/icons/wackypixel/dogs-n-puppies/128/Puppy-1-icon.png";
    var startDest = {lat: 42.3680275, lng: -71.2421328};  // CloudLock HQ
    var endDest   = {lat: 37.7924224, lng: -122.3931885}; // Salesforce HQ
    
    $scope.gotStuff = false;
    $scope.modal = {};
    $scope.groups = {};
    
        
    var arraySize       = ($rootScope.appData.trackerInfo.endTime.getHours() - $rootScope.appData.trackerInfo.startTime.getHours()) * 4;
    var basicArray      = Array.apply(null, {length: arraySize}).map(function(el, index){ return null; });
    
    $scope.graphLabels  = basicArray.map(Number.call, function(index){ return getTimeStampFromTime(getTimeFromIndex(index)); });

    $scope.colors       = [];
    $scope.graphDataSet = [];    
    $scope.paths        = {};
    $scope.markers      = {};
    $scope.stats        = {};
    $scope.center       = {
        lat: 37.5960374,
        lng: -97.0452066,
	zoom: 10
    };
    
    $scope.defaults      = {
        scrollWheelZoom: false
    };

    // from would be today
    // to would be how many days in the past will be viewed
    $scope.history = {};
    $scope.history.from = 0; // 0 == today
    $scope.history.to   = 4;
    
    // Init 
    $scope.activeGroup = 'All users' ;
    $scope.groups = {'All users': {name: 'All users', users: []}};

   
    function getData(){
        return $http.get('api/info').then(function(info){

            // refresh client if UI stageGroups
            if( $rootScope.appData.clientVersion < info.data.clientVersion )  location.reload();
            
        }).then(function(thing){
            $http.get('api/update')
	        .success(function(data, status, headers, config) {        
                    stageGroups(data);
                    $scope.setActiveGroup($scope.activeGroup);
	        });
        }).then(function(){        
            console.log('I HAVE THE HISTORY');
            // Get user history after user data has been gotten
            
            if( !$rootScope.userHistory ){
                $http.get('api/get_history')
                    .then(function(data, status, headers, config){
                        console.log(data);
                        $rootScope.userHistory = data.data;
                        bindUserData();
                    });
            }
        });
        
    }
    
    
    // devide users into groups
    // Run when user list is pulled from server
    function stageGroups(data){
        console.log('stage');        
	$scope.groups['All users'].users = $filter('orderBy')(data, '-distance');
        $rootScope.allUsers = (JSON.parse(JSON.stringify($filter('orderBy')(data, '-fullName'))));
        
        $scope.groups['All users'].users.
            forEach(function(user){
                user.color = ( user.color ? user.color : (randomColor(user.fullName)));
                user.historicDistance = 0;
                user.historicDistances = basicArray.map(function(){return 0;});
                    user.type = 'USER';
            });
        
        // Build list of all groups
        // Init each groups object
        $scope.groups['All users'].users.filter(function(obj){ return obj.group ? true : false })
            .forEach(function(obj){ $scope.groups[obj.group] = {name: obj.group, users: [], historicDistance: 0, historicDistances: []}; });

        // populate the group with its users 
        $scope.groups['All users'].users.filter(function(obj){ return obj.group ? true : false })
            .forEach(function(obj){ $scope.groups[obj.group].users.push(obj) });
        
        $scope.groups['All users'].users.forEach(function(user){
            user.historicDistance  = user.distance;
            user.historicDistances = user.distances;
        });
       
        
        for( var key in $scope.groups ){
            calcGroupStats( $scope.groups[key] );   
        }

    }

    // updates group stats
    // Runs with timescale change or when user list is pulled from server
    function calcGroupStats(group){
        
        // Groups now look like users with a total distance and distances
        group.historicDistance  = group.users.reduce(function(a,b){ return a + (b.historicDistance === null? 0 : b.historicDistance ); }, 0).toFixed(2);
        group.historicDistances = group.users.reduce(function(sum, obj){ return obj.historicDistances.map(function(el, index){return sum[index] +  el; }); }, basicArray.map(function(){return 0;}));
    }
 
    // Binds a users histort record with their data object
    // Now the user can look at their past data
    // Runs when user list is pulled from server
    function bindUserData(){
        // not the most efficiant method but it works
        console.log($rootScope.userHistory);
        $scope.groups['All users'].users.map(function(user){user.history = $rootScope.userHistory.filter(function(record){ return record.act === user.atc }); });
    }

    function calcStats(group){

        // TODO: DAYS
        $scope.stats.days = 'today'
        $scope.stats.totalDistance      = $scope.groups[group].users.reduce(function(sum, obj){ return sum + obj.historicDistance }, 0).toFixed(2); 
        $scope.stats.totalUsers         = $scope.groups[group].users.length;
        $scope.stats.averageDist        = ($scope.stats.totalDistance / $scope.stats.totalUsers).toFixed(2);
        $scope.stats.averageActiveDist  = ($scope.stats.totalDistance / $scope.groups[group].users.filter(function(obj){return obj.historicDistance ;}).length).toFixed(2);
    }
    
    // adds users to graph 
    function displayActiveGroup(group){
        group = JSON.parse(JSON.stringify(group));;

        console.log(group);
        group.users.forEach(function(user){
            user.historicDistance = [];
            user.historicDistances = [];
            user.historicDistance.push(0);
        });

        console.log($rootScope.userHistory);
        // If history has been loaded
        if( $rootScope.userHistory ){
            console.log('here');
            
            // filter history
            // It's assumed that the last element in the historic obj is the data from yesterday
            // Might want to make the filtering method more robust
            group.users.map(function(user){ user.historicWindow = user.history.records.filter(
                function(el, index){ return index >= (x.length - $scope.history.from) && (x.length - $scope.history.to) >= index; }); });

            // pull distance data from records
            // This needs to be able to handle different start and ends time by padding every record accordingly
            // Can leave like this fornow as 5am is the start time for every record
            group.users.map(function(user){ user.historicDistances = user.historicWindow.map(function(record){ return record.distances; }); });
            group.users.map(function(user){ user.historicDistance  = user.historicWindow.map(function(record){ return record.distance; }); });
        }
        
        // Include today if needed 
        if( $scope.history.from === 0 ){
            group.users.forEach(function(user){user.historicDistances.push(user.distances); });
            group.users.forEach(function(user){user.historicDistance.push(user.distance); });
        }
        
        // sum historic distances
        // historic distances = [[1, 2, 3, ...],[4, 5, 6, ...],[7, 8, 9, ...], ...] => [12, 15, 18]
        group.users.forEach(function(user){ user.historicDistances = user.historicDistances.reduce(
            function(sum, obj){ return obj.map(function(el, index){ return sum[index] +  el; }); }, basicArray.map(function(){return 0;})); });
        
        group.users.forEach(function(user){ user.historicDistance = user.historicDistance.reduce(function(sum, el){return sum + el}, 0); });

        console.log(group.users.map(function(obj){return obj.color; })  );
        // update graph
        $scope.graphSeries     = group.users.map(function(obj){return obj.displayName; });     
        $scope.graphDataSet    = group.users.map(function(obj){return obj.historicDistance === 0 ? [] : obj.historicDistances; });
        $scope.colors          = group.users.map(function(obj){return obj.color; });        
    }

    // Adds users to map
    function activeUsers(users){
        // adds a path field to userData

        $scope.markers      = {};
        $scope.paths        = {};

        users = calcPaths(users);
        createPaths(users);
       
        $scope.distanceToObjective = getDistanceFromLatLonInM( startDest.lat, startDest.lng, endDest.lat, endDest.lng);

        var calculatedDist = getDistanceFromLatLonInM(users[users.length - 1].path.start.lat,
                                                      users[users.length - 1].path.end.lng,
                                                      startDest.lat, startDest.lng);

        $scope.percentageValue = calculatedDist / $scope.distanceToObjective;
        
        var centerCoords       =  getMidpoint(users[users.length - 1].path.start, users[0].path.end);
        
        $scope.center.lat      =  centerCoords.lat;
        $scope.center.lng      =  centerCoords.lng;    
    }
    
    $scope.$watch( 'activeGroupName', function(newValue, oldValue){
        if( newValue === '' ) return ;

  //      console.log(newValue);
//        $scope.setActiveGroup(newValue);
    });        
        
    // Listen for server update. Socket.io knows what domain to listen to
    var socket = io('');
    socket.on('db_update', function (data) {
	console.log(data.message);
	getData();
    });
    
    function calcPaths(users){
	var prevCoords =  {lat: 42.3699388, lng: -71.2458321} //Cloudlock HQ;
	var nextCoords = {lat: 0, lng: 0}; // Temp value
	
	for( var i = 0; i < users.length ; i++ ){
	    users[i].path = {start: prevCoords, end: prevCoords = calcCoords( prevCoords, users[i].historicDistance )};
	}
        
	return users;
    }

    function createPaths(users){

        console.log(users);
	users.forEach( function(user){
	    $scope.paths[user.color]= {    
		color: user.color,
		weight: 6,
		latlngs: [
		    user.path.start,
		    user.path.end
		]
	    };
	    
	    $scope.markers[user.color] = {
		lat: user.path.end.lat,
		lng: user.path.end.lng,
		focus: true,
		draggable: false,
		title:   user.name,
		message: user.name,
		icon: {
		    iconUrl: user.avatar,
		    iconSize:     [40, 40],
		    iconAnchor:   [20, 40],
		    popupAnchor:  [3, -32],
		    shadowSize:   [40, 40],
		    shadowAnchor: [0,   0]
		}
	    };
	});       
    }
    
    // Floors time to the preveous quarter hour
    function floorTimeToQuarter(time){
	time.setMilliseconds(Math.floor(time.getMilliseconds() / 1000) * 1000);
	time.setSeconds(Math.floor(time.getSeconds() / 60) * 60);
	time.setMinutes(Math.floor(time.getMinutes() / 15) * 15);
	return time;
    }


    // (TIME.HOURS * 4 ) + TIME.MINUTES - OFFSET
    function getIndexFromTime(time){
	time = floorTimeToQuarter(time);
	return parseInt(time.getHours() * 4 + (time.getMinutes() / 15))
            - $rootScope.appData.trackerInfo.startTime.getHours() * 4; // int
    }


    // Uses time to find the index  
    function calcLastUpdateIndex() {
	var time = new Date();    
	return getIndexFromTime(time);
    }


    function getTimeFromIndex(index) {   
	var time = new Date($rootScope.appData.trackerInfo.startTime);
	time.setMinutes(time.getMinutes() + (index  * 15));
	return time;  // Date obj
    }


    function getTimeStampFromTime(time){
	return time.getHours() + ':' + (time.getMinutes() ? time.getMinutes() : '00') ;  // Str
    }
    
    function getTimeStamp(){
	return getTimeStampFromTime(getTimeFromIndex(calcLastUpdateIndex()));
    }


    function randomColor(seed){
        var factory = new Math.seedrandom(seed);
        var letters = '0123456789ABCDEF'.split('');
	var color = '#';
        
	for (var i = 0; i < 6; i++ ) {   
	    color += letters[Math.floor(factory() * 16)]; // Sooooo goood
	}
	return color;
    }

    $scope.gotoAnchor = function(anchor, event) {
        event.preventDefault();
        event.stopPropagation();       
        $anchorScroll();
    }

    // init stageGroup
    getData();
    
    $scope.setActiveGroup = function(groupName){
        if( !$scope.groups.hasOwnProperty(groupName)) return;

        $scope.activeGroup = groupName;

        displayActiveGroup(  $scope.groups[ $scope.activeGroup ] );
        
        activeUsers( $scope.groups[ $scope.activeGroup ].users.filter(function(obj){return obj.historicDistance !== 0 ;}) );

        calcStats(groupName);
    }

}

function groupModalCtrl($scope, $http, $location, $rootScope, $filter, $fancyModal){
    $scope.openModel = function() {
        $fancyModal.open();
    };
}

function settingsCtrl($scope, $http, $location, $rootScope, $filter, $fancyModal){


    // If no data, go home
    if( !$rootScope.allUsers )
        $location.path('/home');
    $scope.modal = {}

    $scope.closeModal = function(user) {
        $fancyModal.close();
    };

    $scope.reload = function(){
        location.reload();
    };
    
    $scope.updateUser = function(data){
        var userUpdate = {groupName: data.group, user: data.user, color: data.color};
        data.user.color = data.color;
        data.user.group = data.group;


        console.log('Updating user', userUpdate, data);

        $fancyModal.close();
        
        $http.post('/api/update_user_info', userUpdate )
            .success(function(data){
                //                stageGroups();
                console.log('Expecting update req from server. GOODLUCK USER!');
            }); 
    }
    
    $scope.openModal = function(user) {
        $scope.modal.user = user;
        console.log(user);
        $fancyModal.open({
            templateUrl: 'partials/edditUserSettings.html',
            scope: $scope
        });
    }
}


groupModalCtrl.$inject = ['$scope', '$http', '$location', '$rootScope', '$filter',  '$fancyModal'];
settingsCtrl.$inject   = ['$scope', '$http', '$location', '$rootScope', '$filter', '$fancyModal'];
mapCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope', '$filter', 'getInfo',  '$fancyModal', '$anchorScroll'];
appCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope', '$filter'];


/*********** MATH ***********/
function radians(deg){
    return deg * (Math.PI / 180);
};

function degrees(rad){
    return rad * (180 / Math.PI);
};


function getDistanceFromLatLonInM(lat1,lon1,lat2,lon2) {
    Number.prototype.toRad = function() {
	return this * Math.PI / 180;
    }
    var R = 6371; // km 
    //has a problem with the .toRad() method below.
    var x1 = lat2-lat1;
    var dLat = x1.toRad();  
    var x2 = lon2-lon1;
    var dLon = x2.toRad();  
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);  
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; 
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

function getMidpoint( p1, p2) {
    var dLon = radians(p2.lng - p1.lng);

    //convert to radians
    var lat1 = radians(p1.lat);
    var lat2 = radians(p2.lat);
    var lon1 = radians(p1.lng);
    
    var Bx = Math.cos(lat2) * Math.cos(dLon);
    var By = Math.cos(lat2) * Math.sin(dLon);
    
    var lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By));
    var lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

    return {lat: lat3 * 180 / Math.PI, lng: lon3 * 180 / Math.PI};
}

function getBearing(startLat,startLong,endLat,endLong){
    startLat   = radians(startLat);
    startLong  = radians(startLong);
    endLat     = radians(endLat);
    endLong    = radians(endLong);

    var dLong = endLong - startLong;

    var dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
    if (Math.abs(dLong) > Math.PI){
	if (dLong > 0.0)
	    dLong = -(2.0 * Math.PI - dLong);
	else
	    dLong =  (2.0 * Math.PI + dLong);
    }

    return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
}

function calcCoords(from, dist){
    //http://janmatuschek.de/LatitudeLongitudeBoundingCoordinates
    var startDest = {lat: 42.3699388, lng: -71.2458321}; // CloudLock HQ
    var endDest   = {lat: 45.5168567, lng: -122.6725146}; // Salesforce HQ

    var brng = getBearing(startDest.lat, startDest.lng, endDest.lat, endDest.lng);// geo.bearing(startDest, endDest);
    
    var R  = 6378.1;
    var km = dist * 1.60934;

    var lat1 = from.lat * Math.PI / 180;
    var lng1 = from.lng * Math.PI / 180;

    var lat2 = Math.asin( Math.sin(lat1) * Math.cos(km/R) +
			  Math.cos(lat1) * Math.sin(km/R) * Math.cos(brng));

    var lng2 = lng1 + Math.atan2(Math.sin(brng)*Math.sin(km/R)*Math.cos(lat1),
				 Math.cos(km/R)-Math.sin(lat1)*Math.sin(lat2));

    return {lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI};
};
