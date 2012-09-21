/**
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
 * Event collector server for SnowPlow
 * by Simon Rumble <simon@simonrumble.com>
 * 
 * For documentation, see README.md
 * For dependencies,  see package.json
 */
var http = require('http');
var url = require('url');
var os = require('os');

var measured = require('measured');
var fluentdSink = require('fluent-logger');

var config = require('./config');
var cookieManager = require('./libs/cookie-manager');
var responses = require('./libs/responses');
var s3Sink = require('./libs/s3-sink');

var pjson = require('./package.json');

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
 * logging behaviour. Splits each request with
 * a line break
 */
var logToSink = function(message) {
    var json = JSON.stringify(message);
    switch(config.sink.out) {
        case 's3':
            s3Sink.log(json);
            break;
        case 'stdout':
            console.log(json);
            break;
        case 'fluentd':
            fluentdSink.emit(
                config.sink.fluentd.subTag,
                json
            );
        default:
    }
}

/**
 * Build the event to log
 */
var buildEvent = function(request, cookies, timestamp) {
    var event = [];    
    event.push( {
        "hostname" : hostname,
        "date" : timestamp.split('T')[0],
        "time" : timestamp.split('T')[1].split('.')[0],
        "uuid" : cookies.sp,
        "url" : request.url,
        "cookies" : cookies,
        "headers" : request.headers,
        "collector" : collector
    });
    return event;
}

/**
 * One-time initialization for each sink type
 */
switch(config.sink.out) {
    case 's3':
        // Set a timeout to stuff the in-memory
        // events down the pipe to the S3 bucket.
        setInterval(function () {
            s3Sink.upload(config.sink.s3)
        }, config.sink.s3.flushSeconds * 1000);    
        break;
    case 'stdout':
        // No init needed
        break;
    case 'fluentd':
        // Configure the Fluentd logger
        fluentdSink.configure(config.sink.fluentd.mainTag, {
            host: config.sink.fluentd.host,  
            port: config.sink.fluentd.port,
            timeout: config.sink.fluentd.timeout
        });
        break;
    default:
}

// Get the hostname
var hostname = os.hostname();

// Identify this collector
var collector = pjson.name + "-" + pjson.version

// Setup our server monitoring
var monitoring = {
    "stats": measured.createCollection(),
    "memory": new measured.Gauge(function() {
        return process.memoryUsage().rss;
    }),
    "uptime": new measured.Gauge(function() {
        return Math.round(process.uptime());
    })
}

// Web server that does the magic
http.createServer(function (request, response) {

    // Timestamp for this request
    var now = new Date().toISOString();

    // Add to metrics
    monitoring.stats.meter('requestsPerSecond').mark();

    // Switch based on requested URL
    switch(url.parse(request.url).pathname) {

        // ice.png is legacy name for i
        case '/ice.png':
		case '/i':
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
            responses.sendStatus(response, hostname, collector, monitoring);
            break;

        default:
            responses.send404(response);
    }

    // Log the request to console
    logToConsole(now + ' ' + request.url);

}).listen(config.server.httpPort);
