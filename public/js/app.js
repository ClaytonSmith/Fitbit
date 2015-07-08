'use strict';



// Declare app level module which depends on filters, and services                                          
var app = angular.module('myApp', [
    'ngResource',
    'ngRoute',
    'myApp.filters',
    'myApp.services',
    'myApp.directives',
    'leaflet-directive',
    'chart.js',
    'isteven-omni-bar',
    'vesparny.fancyModal',
    'mp.colorPicker'
]);

// Configure angular client side routing
app.config(['$routeProvider', '$locationProvider', '$fancyModalProvider', function($routeProvider, $locationProvider, $fancyModalProvider) {
    $routeProvider.when('/settings',  {templateUrl: 'partials/settings', controller: settingsCtrl});
    $routeProvider.when('/home',
                        {templateUrl: 'partials/home', controller: mapCtrl,
			 resolve: ['getInfo', function(getInfo){	
			     return getInfo.promise;
			 }]});
    
    $fancyModalProvider.setDefaults({
        template: '<div>I\'m a basic template</div>'
    });
    
    //	//Default path
    $routeProvider.otherwise({redirectTo: '/home'});
    $locationProvider.html5Mode(true);
}]);




