'use strict';

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
function mapCtrl($scope, $http, $location, $rootScope, $filter, getInfo, $fancyModal){
    $rootScope.appData = getInfo.getData();
    console.log("Hello from map controller.", $rootScope.appData);
    

    var cloudLockLogo = "http://icons.iconarchive.com/icons/wackypixel/dogs-n-puppies/128/Puppy-1-icon.png";
    var startDest = {lat: 42.3680275, lng: -71.2421328};  // CloudLock HQ
    var endDest   = {lat: 37.7924224, lng: -122.3931885}; // Salesforce HQ
    
    $scope.gotStuff = false;
    $scope.modal = {};
    $scope.groups = {};
    
    function randomColor(seed){
        var factory = new Math.seedrandom(seed);
        var letters = '0123456789ABCDEF'.split('');
	var color = '#';
        
	for (var i = 0; i < 6; i++ ) {   
	    color += letters[Math.floor(factory() * 16)]; // Sooooo goood
	}
	return color;
    }

    $scope.openModal = function(user) {
        $scope.modal.user = user;
        console.log(user);
        $fancyModal.open({
            template:
            '<div style="height: 100px"><div class="center">What group would you like to add {{modal.user.displayName}} to?</div>'+
                '<br><input style="width: 60%; margin-left: 85px;" type="text" ng-model="groupName"></input>'+
                '<br><div style="float: right;"><br>'+
                '<button class="pure-button button-warning" ng-click="closeModal()" style="margin-right: 20px;">Cancel</button>'+
                '<button class="button-success pure-button" ng-click="addUserToGroup(modal.user, groupName)">Add</button></div></div>',
            scope: $scope
        });
    };

    $scope.addUserToGroup = function(user, groupName){

        var groupData = {user: user, groupName: groupName};
        console.log('adding user to group', groupData);
        $fancyModal.close();
        
        $http.post('/api/add_user_to_group', groupData )
            .success(function(data){
                //                update();
                console.log('Expecting update req from server. GOODLUCK USER!');
            });
    }
    
    $scope.closeModal = function(user) {
        $fancyModal.close();
    };


    $scope.gotoAnchor = function(anchor) {
        if ($location.hash() !== anchor) {
            // set the $location.hash to `newHash` and
            // $anchorScroll will automatically scroll to it
            $location.hash(anchor);
        } else {
            // call $anchorScroll() explicitly,
            // since $location.hash hasn't changed
            $anchorScroll();
        }
    }
        
    var totalDistance = 0;
    var arraySize = ($rootScope.appData.trackerInfo.endTime.getHours() - $rootScope.appData.trackerInfo.startTime.getHours()) * 4;
    var basicArray = Array.apply(null, {length: arraySize}).map(function(el, index){ return null; });
    
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

    $scope.activeGroup = 'All users' ;
    $scope.groups = {'All users': {name: 'All users', users: []}};
     
    function update(){
        $http.get('api/info').then(function(info){
            console.log( $rootScope.appData, info.data);

            // refresh client if UI update
            if( $rootScope.appData.clientVersion < info.data.clientVersion ){
                location.reload();
            }
            
        }).then(function(thing){
            
            $http.get('api/update')
	        .success(function(data, status, headers, config) {

                    
		    $scope.groups['All users'].users = $filter('orderBy')(data, '-distance');
                    $rootScope.allUsers =  (JSON.parse(JSON.stringify($filter('orderBy')(data, '-fullName'))));

                    $scope.groups['All users'].users.forEach(function(obj){ obj.color = ( obj.color ? obj.color : (randomColor(obj.fullName))); obj.type = 'USER'; });

                    // Build list of all groups
                    // Init each groups object
                    $scope.groups['All users'].users.filter(function(obj){ return obj.group ? true : false })
                        .forEach(function(obj){ $scope.groups[obj.group] = {name: obj.group, users: [], distance: 0}; });

                    // populate the group with its users 
                    $scope.groups['All users'].users.filter(function(obj){ return obj.group ? true : false })
                        .forEach(function(obj){ $scope.groups[obj.group].users.push(obj) });

                    // Fill in some basic data 
                    for( var key in $scope.groups ){
                        $scope.groups[key].distance  = $scope.groups[key].users.reduce(function(a,b){ return a + (b.distance === null? 0 :b.distance); }, 0).toFixed(2);
                        $scope.groups[key].distances = $scope.groups[key].users.reduce(
                            function(sum, obj){ return obj.distances.map(function(el,index){return sum[index] +  el; });}, basicArray.map(function(){return 0;}));                        
                    }
                    
                }).then(function(data){
                    
                    // Have graph and charts redraw
                    $scope.setActiveGroup($scope.activeGroup);
                    calcStats();
	        });
        });
    }
    
    function calcStats(){

        // TODO: DAYS
        $scope.stats.days = 'today'
        $scope.stats.totalDistance      = $scope.groups['All users'].users.reduce(function(sum, obj){ return sum + obj.distance }, 0); 
        $scope.stats.totalUsers         = $scope.groups['All users'].users.length;
        $scope.stats.averageDist        = ($scope.stats.totalDistance / $scope.stats.totalUsers).toFixed(2);
        $scope.stats.averageActiveDist  = ($scope.stats.totalDistance
                                           /$scope.groups['All users'].users.filter(function(obj){return obj.distance ;}).length).toFixed(2);
    }
    
    $scope.setActiveGroup = function(groupName){
        if( !$scope.groups.hasOwnProperty(groupName)) return;
        activeGroup( $scope.groups[groupName] );
        activeUsers( $scope.groups[groupName].users.filter(function(obj){return obj.distance !== 0 ;}) );
    }

    // adds users to graph 
    function activeGroup(group){
        group = JSON.parse(JSON.stringify(group));;
        var sudoUser = {
            displayName: group.name,
            distances: group.distances
        }

        //        group.users.insert(0, sudoUser);
        //        console.log(group.users);
        
        // update graph
        $scope.graphSeries     = group.users.map(function(obj){return obj.displayName; });     
        $scope.graphDataSet    = group.users.map(function(obj){return obj.distance === 0 ? [] : obj.distances; });  //.splice(0, calcLastUpdateIndex() + 1) });       
        $scope.colors          = group.users.map(function(obj){return obj.color; });        
        // Other things
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
        console.log(newValue);
        $scope.setActiveGroup(newValue);
    });        
    
    // init update 
    update();
    
    // Listen for server update. Socket.io knows what domain to listen to
    var socket = io('');
    socket.on('db_update', function (data) {
	console.log(data.message);
	update();
    });
    
    function calcPaths(users){
	var prevCoords =  {lat: 42.3699388, lng: -71.2458321} //Cloudlock HQ;
	var nextCoords = {lat: 0, lng: 0}; // Temp value
	
	for( var i = 0; i < users.length ; i++ ){
	    users[i].path = {start: prevCoords, end: prevCoords = calcCoords( prevCoords, users[i].distance )};
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
		    iconUrl: user.avatar || cloudLockLogo,
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
                //                update();
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
settingsCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope', '$filter', '$fancyModal'];
mapCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope', '$filter', 'getInfo',  '$fancyModal'];
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
