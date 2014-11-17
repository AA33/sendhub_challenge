/**
 * Created by abhishekanurag on 11/15/14.
 */
(function () {
    'use strict';

    var app = angular.module('app', []);

    app.constant('appConstants', {
        DEFAULT_THRESHOLD: 0.05,
        DEFAULT_CONTACT: 6086094946,
        DEFAULT_MESSSAGE: "Quiet please!",

        RESPONSE_DURATION: 200,
        THRESHOLD_DURATION: 1000,
        NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW: 3,

        VOLUME_DATA_READY_EVENT: "VOLUME_DATA_READY",

        API_KEY: "b75409abea9550616ed31c627952fff9efe585c6",
        CORS_API_URL: "https://cors-anywhere.herokuapp.com/",
        SENDHUB_API_URL: "https://api.sendhub.com/v1/messages/",

        VISUALIZER_TICK_VALUES: [0.0,0.2,0.4,0.6,0.8,1.0]
    });

    app.controller('AlertCtrl', ['$scope', '$timeout', 'micListener', 'messenger', 'appConstants',
        function ($scope, $timeout, micListener, messenger, appConstants) {

            var RESPONSE_DURATION = appConstants.RESPONSE_DURATION,
                THRESHOLD_DURATION = appConstants.THRESHOLD_DURATION,
                DATA_POINTS_FOR_CROSSING_THRESHOLD = THRESHOLD_DURATION / RESPONSE_DURATION,
                DEFAULT_THRESHOLD = appConstants.DEFAULT_THRESHOLD,
                DEFAULT_CONTACT = appConstants.DEFAULT_CONTACT,
                DEFAULT_MSG = appConstants.DEFAULT_MESSSAGE,
                NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW = appConstants.NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW;

            $scope.highestOutputs = [];
            $scope.contact = DEFAULT_CONTACT;
            $scope.threshold = DEFAULT_THRESHOLD;
            $scope.phonePattern = /^\d{10}$/;
            $scope.volumeData = [];
            $scope.running = false;

            var highestOutputs = $scope.highestOutputs,
                volumeData = $scope.volumeData;

            function volumeDataHandler(data) {
                var threshold = parseFloat($scope.threshold);
                if (isNaN(threshold)) {
                    threshold = DEFAULT_THRESHOLD;
                }
                volumeData.push({
                    volume: data,
                    timestamp: new Date().getTime()
                });

                var needsAlert = true,
                    dataPoints = volumeData.length,
                    loudDataPoints = 0,
                    output = 0;
                //Has volume been too loud for over a second in the current period

                //Do we have data for more than a second yet
                if (dataPoints > DATA_POINTS_FOR_CROSSING_THRESHOLD) {
                    for (var i = dataPoints - 1; i >= 0; i--) {
                        if (volumeData[i].volume > threshold) {
                            loudDataPoints++;
                        }
                        output += (volumeData[i].volume * RESPONSE_DURATION);
                    }
                    if (loudDataPoints <= DATA_POINTS_FOR_CROSSING_THRESHOLD)
                        needsAlert = false;
                } else {
                    needsAlert = false;
                }

                if (needsAlert) {
                    var outputDetails = {
                        output: output,
                        start: new Date(volumeData[0].timestamp).toLocaleTimeString(),
                        end: new Date(volumeData[dataPoints - 1].timestamp).toLocaleTimeString()
                    };
                    //Is the current output louder than at least one of the 3 loudest periods
                    var cmp = function (a, b) {
                        return b.output - a.output;
                    };

                    if (highestOutputs.length < NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW) {
                        highestOutputs.push(outputDetails);
                        highestOutputs.sort(cmp);
                    } else if (highestOutputs[NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW - 1].output < outputDetails.output) {
                        highestOutputs[NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW - 1] = outputDetails;
                        highestOutputs.sort(cmp);
                    } else {
                        needsAlert = false;
                    }

                }

                if (needsAlert) {
                    messenger.sendMessage(DEFAULT_MSG, ["+1" + $scope.contact]);
                    console.log("Sending message");
                    volumeData = $scope.volumeData = [];
                }
            }

            micListener.whenDataReceived($scope, volumeDataHandler);
            $scope.start = function () {
                if (!$scope.running) {
                    micListener.startListenService(RESPONSE_DURATION);
                    $timeout(function(){
                        $scope.running = true;
                    },1000);
                }
            };

            $scope.stop = function () {
                if ($scope.running) {
                    micListener.stopListenService();
                    $timeout(function(){
                        $scope.running = false;
                    },1000);
                }
            };


        }
    ]);

    app.factory('micListener', ['$window', '$rootScope', 'appConstants',
        function ($window, $rootScope, appConstants) {
            var VOLUME_DATA_READY_EVENT = appConstants.VOLUME_DATA_READY_EVENT;

            try {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                window.audioContext = new AudioContext();
            } catch (e) {
                alert('Web Audio API not supported.');
            }
            var soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
            var constraints = $window.constraints = {
                audio: true,
                video: false
            };
            var navigator = $window.navigator;
            navigator.getUserMedia = navigator.getUserMedia ||
                navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            function successCallback(stream) {
                soundMeter.connectToSource(stream);
            }

            function errorCallback(error) {
                console.log('navigator.getUserMedia error: ', error);
            }

            navigator.getUserMedia(constraints, successCallback, errorCallback);

            var serviceInterval;

            function startListenService(responseDuration) {
                serviceInterval = setInterval(function () {
                    var vol = soundMeter.instant.toFixed(2);
                    $rootScope.$broadcast(VOLUME_DATA_READY_EVENT, vol);
                }, responseDuration);
            }

            function stopListenService() {
                clearInterval(serviceInterval);
            }

            function whenDataReceived($scope, handler) {
                var cleanUp = $scope.$on(VOLUME_DATA_READY_EVENT, function (event, data) {
                    handler(data);
                });
                $scope.$on('$destroy', function() {
                    cleanUp();
                });
            }

            var services = {
                startListenService: startListenService,
                stopListenService: stopListenService,
                whenDataReceived: whenDataReceived
            };
            return services;
        }
    ]);

    app.factory('messenger', ['$http', 'appConstants',
        function ($http, appConstants) {
            var USERNAME = "" + appConstants.DEFAULT_CONTACT,
                API_KEY = appConstants.API_KEY,
                CORS_API_URL = appConstants.CORS_API_URL,
                SENDHUB_API_URL = appConstants.SENDHUB_API_URL + "?username=" + USERNAME + "&api_key=" + API_KEY;

            function sendMessage(msgtext, contacts) {
                var msg = {};
                msg.contacts = contacts;
                msg.text = msgtext;
                $http.post(CORS_API_URL + SENDHUB_API_URL, msg)
                    .success(function (data) {
                        console.log("Sent: " + data.acknowledgment);
                    })
                    .error(function () {
                        console.log("Msg sending failed!");
                    });
            }

            var services = {
                sendMessage: sendMessage
            };
            return services;
        }
    ]);


    app.controller('VisualizerCtrl',['$scope', 'micListener', 'appConstants',
        function($scope, micListener, appConstants){
            var n = 40,
                random = d3.random.normal(0, .2),
                data = d3.range(n).map(function(){
                    return 0;
                });

            var start_y = 460*(1-appConstants.DEFAULT_THRESHOLD);

            var margin = {top: 20, right: 20, bottom: 20, left: 40},
                width = 960 - margin.left - margin.right,
                height = 500 - margin.top - margin.bottom;

            var x = d3.scale.linear()
                .domain([1, n - 2])
                .range([0, width]);

            var y = d3.scale.linear()
                .domain([0, 1])
                .range([height, 0]);

            var line = d3.svg.line()
                .interpolate("basis")
                .x(function(d, i) { return x(i); })
                .y(function(d, i) { return y(d); });

            var svg = d3.select("body").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            svg.append("defs").append("clipPath")
                .attr("id", "clip")
                .append("rect")
                .attr("width", width)
                .attr("height", height);

            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + y(0) + ")")
                .call(d3.svg.axis().scale(x).orient("bottom").tickValues([]));

            svg.append("g")
                .attr("class", "y axis")
                .call(d3.svg.axis().scale(y).orient("left").tickValues(appConstants.VISUALIZER_TICK_VALUES));

            svg.append("path")
                .attr("class", "line")
                .style("stroke-dasharray", ("3, 3"))
                .attr("d", "M0 "+start_y+" L900 "+start_y);

            var path = svg.append("g")
                .attr("clip-path", "url(#clip)")
                .append("path")
                .datum(data)
                .attr("class", "line")
                .attr("d", line);

            function tick(value) {
                data.push(value);

                path
                    .attr("d", line)
                    .attr("transform", null)
                    .transition()
                    .duration(0)
                    .ease("linear")
                    .attr("transform", "translate(" + x(0) + ",0)")
                data.shift();

            }
            micListener.whenDataReceived($scope, tick);
        }
    ]);

}());