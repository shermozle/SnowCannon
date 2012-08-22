/**
 * Copyright (c) 2012 Simon Rumble. All rights reserved.
 *
 * This program is licensed to you under the Apache License Version 2.0,
 * and you may not use this file except in compliance with the Apache License Version 2.0.
 * You may obtain a copy of the Apache License Version 2.0 at http: *www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the Apache License Version 2.0 is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the Apache License Version 2.0 for the specific language governing permissions and limitations there under.
 */

/**
 * SnowCannon
 *
 * node.js web analytics data collection server for SnowPlow.
 * Logs web analytics beacons to gzipped files in S3.
 *
 * By Simon Rumble <simon@simonrumble.com>
 *
 * Depends on the following NPM packages:
 * npm install knox node-uuid measured
 */

// TODO
//
// Perhaps AWS has a unique name for the host? Maybe call out to shell for `hostname -A`?
// Put host into the logged output for debugging
// Make output proper JSON with header names
// Real-time output
// Status response for Pingdom et al
// Get configuration from EC2 variables
// Build auto scaling
// Batch job to consolidate all of a day's data into one file for compression optimization
// SSL support

var http = require('http');
var url = require('url');
var measured = require('measured');

var config = require('./config');
var cookieManager = require('./libs/cookie-manager');
var responses = require('./libs/responses');
var s3Sink = require('./libs/s3-sink');

/**
 * Don't pollute stdout if it's being used to capture
 * the event stream.
 */
var logToConsole = function(message) {
    if (config.sink.out !== "stdout") {
        console.log(message);
    }
}

/**
 * Logs to the current sink, with sink-specific
 * logging behaviour.
 */
var logToSink = function(message) {
    switch(config.sink.out) {
        case 's3':
            s3Sink.log(message);
            break;
        case 'stdout':
            console.log(JSON.stringify(message));
            break;
        default:
    }
}

/**
 * Build the event to log
 */
var buildEvent = function(request, cookies, timestamp) {
    var event = [];    
    event.push(timestamp.split('T')[0], timestamp.split('T')[1].split('.')[0], cookies.sp, request.url, cookies, request.headers);
    return event;
}

// If we are using the S3 sink, set a timeout to stuff the
// in-memory events down the pipe to the S3 bucket.
if (config.sink.out === "s3") {
	setInterval(function () {
		s3Sink.upload(config.sink.s3)
	}, config.sink.s3.flushSeconds * 1000);
}

// Setup our server monitoring
var stats = measured.createCollection();
var memory = new measured.Gauge(function() {
  return process.memoryUsage().rss;
});
var uptime = new measured.Gauge(function() {
  return Math.round(process.uptime());
});

// Web server that does the magic
http.createServer(function (request, response) {

    // Timestamp for this request
    var now = new Date().toISOString();

    // Add to metrics
    stats.meter('requestsPerSecond').mark();

    // Switch based on requested URL
    switch(url.parse(request.url).pathname) {

        case '/ice.png':
            var cookies = cookieManager.getCookies(request.headers);
            var cookieContents = cookieManager.getCookieContents(config.cookie.domainName);
            
            var event = buildEvent(request, cookies, now);
            logToSink(event);

            responses.sendCookieAndPixel(response, cookies.sp, config.cookie.milliseconds, cookieContents);
            break;

        case '/healthcheck':
            responses.send200(response);
            break;

        case '/status':
            responses.sendStatus(response, stats, memory, uptime);
            break;

        default:
            responses.send404(response);
    }

    // Log the request to console
    logToConsole(now + ' ' + request.url);

}).listen(config.server.httpPort);