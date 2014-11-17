/**
 * Created by abhishekanurag on 11/16/14.
 */
'use strict';

describe('alerter view', function () {

    var $scope, micListener, messenger, appConstants, viewCtrl, serviceInterval = {};
    beforeEach(module('app'));

    beforeEach(inject(function ($injector) {
        appConstants = $injector.get('appConstants');
        messenger = $injector.get('messenger');
        micListener = jasmine.createSpyObj("micListener", ["startListenService", "stopListenService", "whenDataReceived"]);
    }));

    describe('app controller', function () {

        var vols = [0.5, 0.5, 0.1, 0.1, 0.1, 0.2, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.5];


        var mockStartListenServiceGetter = function (whichVols, serviceInterval, $rootScope) {
            return function (responseDuration) {
                var vols = whichVols;
                var i = 0;
                serviceInterval = setInterval(function () {
                    var vol = vols[i % vols.length];
                    i++;
                    $rootScope.$broadcast(appConstants.VOLUME_DATA_READY_EVENT, vol);
                    console.log("Broadcasted:" + vol);
                }, responseDuration);
            };
        };

        var mockWhenDataReceived = function ($scope, handler) {
            $scope.$on(appConstants.VOLUME_DATA_READY_EVENT, function (event, data) {
                handler(data);
            });
        };


        it('should initialize with fake listener and populate outputs as expected', inject(function ($controller, $rootScope) {
            $scope = $rootScope.$new();
            var stopListenService = function () {
                clearInterval(serviceInterval);
            };

            micListener.startListenService = jasmine.createSpy("startListenService");
            micListener.whenDataReceived = jasmine.createSpy("mockWhenDataReceived");
            micListener.startListenService.andCallFake(mockStartListenServiceGetter(vols, serviceInterval, $scope));
            micListener.whenDataReceived.andCallFake(mockWhenDataReceived);

            viewCtrl = $controller('AlertCtrl', {
                $scope: $scope,
                micListener: micListener,
                messenger: messenger,
                appConstants: appConstants
            });
            expect(viewCtrl).toBeDefined();
            expect($scope.start).toBeDefined();
            $scope.start();
            expect($scope.highestOutputs.length).toBe(0);
            waitsFor(function () {
                return $scope.highestOutputs.length === 1;
            }, 'size to reach 1.', 1200);
            waitsFor(function () {
                return ($scope.highestOutputs.length === 2);
            }, 'size to reach 2.', 1200);
            waitsFor(function () {
                return ($scope.highestOutputs.length === 3);
            }, 'size to reach 3',1200);

            runs(function(){
                expect($scope.stop).toBeDefined();
                expect($scope.highestOutputs.length).toBe(3);
                $scope.stop();
                expect($scope.highestOutputs[0].output).toBe(720);
                expect($scope.highestOutputs[1].output).toBe(360);
                expect($scope.highestOutputs[2].output).toBe(300);

                //Now the real test for 2.b
                for(var i=0; i<6; i++){
                    vols[i] = 0.7;
                }
                $scope.start();
                waitsFor(function () {
                    return ($scope.highestOutputs[0].output > 720);
                }, 'Max to exceed old max',1200);

                runs(function(){
                    expect($scope.highestOutputs.length).toBe(3);
                    $scope.stop();
                    expect($scope.highestOutputs[0].output).toBe(800);
                    expect($scope.highestOutputs[1].output).toBe(720);
                    expect($scope.highestOutputs[2].output).toBe(360);
                });

            });

        }));

    });
});
