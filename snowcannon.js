// Copyright (c) 2012 Simon Rumble. All rights reserved.
//
// This program is licensed to you under the Apache License Version 2.0,
// and you may not use this file except in compliance with the Apache License Version 2.0.
// You may obtain a copy of the Apache License Version 2.0 at http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the Apache License Version 2.0 is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the Apache License Version 2.0 for the specific language governing permissions and limitations there under.

// SnowCannon
//
// Node.js web analytics data collection server. Logs web analytics beacons
// to gzipped files in S3.
// By Simon Rumble <simon@simonrumble.com>

// Depends on the following NPM packages:
// npm install knox node-uuid

// TODO
//
// DONE Set cookie to long-expiry
// DONE P3P header for IE
// DONE Write out 1x1 transparent GIF
// DONE Log the HTTP headers
// DONE Log all the cookies
// DONE Keep data around for 10 mins and if data, flush to S3
// DONE Gzip it so we're not spending $$$ storing data we don't need to
// DONE Get it uploading unique file names. Timestamp + host?
// Perhaps AWS has a unique name for the host? Maybe call out to shell for `hostname -A`?
// Put host into the logged output for debugging
// Make output proper JSON with header names
// Real-time output
// Status response for Pingdom et al
// Get configuration from EC2 variables
// Configuration options:
// * S3 bucket and credentials
// * Domain name for cookie
// * Real-time destination
// * Monitoring
// * Expiry of cookie
// Build auto scaling
// Batch job to consolidate all of a day's data into one file for compression optimization
// SSL support

var http = require('http');
var uuid = require('node-uuid');

var config = require('./config');
var s3Sink = require('./libs/s3-sink');

// 1x1 transparent pixel thanks to sspencer https://gist.github.com/657246
var imageData = [
  0x47,0x49, 0x46,0x38, 0x39,0x61, 0x01,0x00, 0x01,0x00, 0x80,0x00, 0x00,0xFF, 0xFF,0xFF,
  0x00,0x00, 0x00,0x21, 0xf9,0x04, 0x04,0x00, 0x00,0x00, 0x00,0x2c, 0x00,0x00, 0x00,0x00,
  0x01,0x00, 0x01,0x00, 0x00,0x02, 0x02,0x44, 0x01,0x00, 0x3b
];
var imageBuffer = new Buffer(imageData);

// Pull together the little bit that goes in the cookie string for the domain
if (config.cookie.domainName !== undefined) {
	cookieContents = 'Domain=' + config.cookie.domainName + ';';
} else {
	cookieContents = '';
}

// If we are using the S3 sink, set a timeout to stuff the
// in-memory events down the pipe to the S3 bucket.
if (config.sink.out === "s3") {
	setInterval(function () {
		s3Sink.upload(config.sink.s3)
	}, config.sink.s3.flushSeconds * 1000);
}

// Web server that does the magic
http.createServer(function (request, response) {
	var requestLog = [];

	// To get a Cookie
	var cookies = {};
  	request.headers.cookie && request.headers.cookie.split(';').forEach(function( cookie ) {
    	var parts = cookie.split('=');
    	cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
  	});

  	// If there's no "sp" cookie, create a UUID for it
	if (cookies.sp === undefined) {
		cookies.sp = uuid.v4();
	}
	var date = new Date();
	requestLog.push(date.toISOString().split('T')[0], date.toISOString().split('T')[1].split('.')[0], cookies.sp, request.url, cookies, request.headers);

 	// Write out the cookie
	response.writeHead(200, {
 		'Set-Cookie': 'sp=' + cookies.sp + '; expires='+ new Date(new Date().getTime()+config.cookie.milliseconds).toUTCString() + ';' + cookieContents,
 		'P3P': 'policyref="/w3c/p3p.xml", CP="NOI DSP COR NID PSA OUR IND COM NAV STA',
 		'Content-Type': 'image/gif',
        'Content-Length': imageData.length
	});
	// Send pixel
	response.end(imageBuffer);

	// Push the log stuff to log except if the URL is /healthcheck
	if (request.url === '/healthcheck') {
		if (config.sink.out !== "stdout") { // Don't pollute the stdout event stream
			console.log(date.toISOString() + ' /healthcheck');
		}
	} else {
		if (config.sink.out === "s3") { // Add to the in-memory log for S3
		s3Sink.log(requestLog)			
		} else {
			var outputLog = JSON.stringify(requestLog);
			if (config.sink.out === "stdout") { // Print event to stdout
				console.log(outputLog);
			}
		}
	}
	
}).listen(config.server.httpPort);