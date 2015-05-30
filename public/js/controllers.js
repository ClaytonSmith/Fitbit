'use strict';

// Helper function 
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
function appCtrl($scope, $http, $location, $rootScope) {
    console.log('Hello from app controller.');
}


/* Controllers */
function mapCtrl($scope, $http, $location, $rootScope) {
    console.log("Hello from map controller.");
}

mapCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope'];
appCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope'];





