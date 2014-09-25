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

var cluster = require('cluster');
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
};

/**
 * Logs to the current sink, with sink-specific
 * logging behaviour. Splits each request with
 * a line break
 */
var logToSink = function(message) {
    var json = JSON.stringify(message),
    logrow = message[0].join("\t");
    switch(config.sink.out) {
        case 's3':
            s3Sink.log(logrow);
            break;
        case 'stdout':
            console.log(logrow);
            break;
        case 'fluentd':
            fluentdSink.emit(
                config.sink.fluentd.subTag,
                json
            );
        default:
    }
};

/**
 * Build the event to log
 */
var buildEvent = function(request, cookies, timestamp) {
    parsedUrl = url.parse(request.url);
    var event = [];
    event.push( [
        //     "2013-10-07  19:47:54    -   37  255.255.255.255 GET 255.255.255.255 /i  200 http://snowplowanalytics.com/blog/2012/10/31/snowplow-in-a-universal-analytics-world-what-the-new-version-of-google-analytics-means-for-companies-adopting-snowplow/    Mozilla%2F5.0+%28Macintosh%3B+Intel+Mac+OS+X+10_6_8%29+AppleWebKit%2F537.36+%28KHTML%2C+like+Gecko%29+Chrome%2F31.0.1650.8+Safari%2F537.36  e=pv&page=Snowplow%20in%20a%20Universal%20Analytics%20world%20-%20what%20the%20new%20version%20of%20Google%20Analytics%20means%20for%20companies%20adopting%20Snowplow%20-%20Snowplow%20Analytics&dtm=1381175274123&tid=958446&vp=1440x802&evn=com.snowplowanalytics&ds=1425x4674&vid=1&duid=d159c05f2aa8e1b9&p=web&tv=js-0.12.0&fp=812263905&aid=snowplowweb&lang=en-US&cs=UTF-8&tz=Europe%2FLondon&refr=https%3A%2F%2Fwww.google.co.uk%2Furl%3Fsa%3Dt%26rct%3Dj%26q%3D%26esrc%3Ds%26source%3Dweb%26cd%3D3%26ved%3D0CDsQFjAC%26url%3Dhttp%253A%252F%252Fsnowplowanalytics.com%252Fblog%252F2012%252F10%252F31%252Fsnowplow-in-a-universal-analytics-world-what-the-new-version-of-google-analytics-means-for-companies-adopting-snowplow%252F%26ei%3DuQ9TUonxBcLL0QXc74DoDg%26usg%3DAFQjCNFWhV4rr2zmRm1fe4hNiay6Td9VrA%26bvm%3Dbv.53537100%2Cd.d2k&f_pdf=1&f_qt=1&f_realp=0&f_wma=0&f_dir=0&f_fla=1&f_java=1&f_gears=0&f_ag=1&res=1440x900&cd=24&cookie=1&url=http%3A%2F%2Fsnowplowanalytics.com%2Fblog%2F2012%2F10%2F31%2Fsnowplow-in-a-universal-analytics-world-what-the-new-version-of-google-analytics-means-for-companies-adopting-snowplow%2F&cv=clj-0.5.0-tom-0.0.4&nuid=8712a379-4bcb-46ee-815d-85f26540577f  -   -   -"

        timestamp.split('T')[0], // date
        timestamp.split('T')[1].split('.')[0], // time
        '-', // x-edge-location
        37, // sc-bytes
        request.connection.remoteAddress, // c-ip
        request.method, //cs-method
        request.headers['host'].split(':')[0], // cs(Host)
        parsedUrl.pathname, // cs-uri-stem
        200, // sc-status
        request.headers['referrer'] || '',// cs(Referrer)
        request.headers['user-agent'],// cs(User-Agent)
        parsedUrl.query, // cs-uri-query
        '-',   
        '-',
        '-'
    ]);
    return event;
};

/**
 * One-time initialization for each sink type
 */
switch(config.sink.out) {
    case 's3':
        // Set a timeout to stuff the in-memory
        // events down the pipe to the S3 bucket.
        setInterval(function () {
            s3Sink.upload(config.sink.s3);
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
var collector = pjson.name + "-" + pjson.version;

// How many CPUs?
var numCPUs = os.cpus().length;

/**
 * Setup our server monitoring
 */
var monitoring = {
    "stats": measured.createCollection(),
    "memory": new measured.Gauge(function() {
        return process.memoryUsage().rss;
    }),
    "uptime": new measured.Gauge(function() {
        return Math.round(process.uptime());
    })
};

/**
 * Roll our own clustering
 */
if (cluster.isMaster) {
    // Fork workers
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', function(worker, code, signal) {
        console.error('SnowCannon worker ' + worker.process.pid + ' died');
    });

} else {
    // Workers can share any TCP connection
    // In this case its a HTTP server
    http.createServer(function (request, response) {

        // Timestamp for this request
        var now = new Date().toISOString();

        // Add to metrics
        monitoring.stats.meter('requestsPerSecond').mark();

        // Switch based on requested URL
        switch(url.parse(request.url).pathname) {

            // ice.png is legacy name for i
            // We use /i for the initial query, but if they don't have a cookie set, we set the cookie and redirect back to /r
            // which then logs it without a network_userid value so it'll fall back to domain_userid. Yes I know Crockford says
            // not to do this with case statements.
            case '/ice.png':
            case '/i':
            case '/r':
                var cookies = cookieManager.getCookies(request.headers);
                var cookieContents = cookieManager.getCookieContents(config.cookie.domainName);
                
                var event = buildEvent(request, cookies, now);

                if ((cookies.sp && cookies.age !== 'new') || url.parse(request.url).pathname === '/r') {
                    responses.sendCookieAndPixel(response, cookies.sp, config.cookie.milliseconds, cookieContents);
                    logToSink(event);
                } else {
                    // TODO: Find out the protocol and use the appropriate one?
                    var redirectUrl = 'https://' + request.headers.host + url.parse(request.url).search;
                    responses.testCookie(response, cookies.sp, redirectUrl, config.cookie.milliseconds, cookieContents);
                }
                break;

            case '/healthcheck':
                responses.send200(response);
                break;

            case '/status':
                responses.sendStatus(response, hostname, collector, numCPUs, monitoring);
                break;

            default:
                responses.send404(response);
        }

        // Log the request to console
        logToConsole(now + ' ' + request.url);

    }).listen(config.server.httpPort);
}