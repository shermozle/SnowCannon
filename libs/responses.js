var responses = {};

// 1x1 transparent pixel thanks to sspencer https://gist.github.com/657246
var imageData = [
    0x47,0x49, 0x46,0x38, 0x39,0x61, 0x01,0x00, 0x01,0x00, 0x80,0x00, 0x00,0xFF, 0xFF,0xFF,
    0x00,0x00, 0x00,0x21, 0xf9,0x04, 0x04,0x00, 0x00,0x00, 0x00,0x2c, 0x00,0x00, 0x00,0x00,
    0x01,0x00, 0x01,0x00, 0x00,0x02, 0x02,0x44, 0x01,0x00, 0x3b
];
var imageBuffer = new Buffer(imageData);

/**
 * Respond with a 404.
 */
responses.send404 = function(response) {

    response.writeHead(404, {"Content-Type": "text/plain"});
    response.write("404 Not found");
    response.end();
}

/**
 * Respond with 200.
 */
responses.send200 = function(response) {

    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write("OK");
    response.end();
}

/**
 * Respond with a transparent pixel and the cookie.
 */
responses.sendCookieAndPixel = function(response, cookieId, cookieDuration, cookieContents) {

 	// Write out the cookie
	response.writeHead(200, {
 		'Set-Cookie': 'sp=' + cookieId + '; expires='+ new Date(new Date().getTime()+cookieDuration).toUTCString() + ';' + cookieContents,
 		'P3P': 'policyref="/w3c/p3p.xml", CP="NOI DSP COR NID PSA OUR IND COM NAV STA"',
 		'Content-Type': 'image/gif',
        'Content-Length': imageData.length
	});
	// Send pixel
	response.end(imageBuffer);
}
/*
* Try to set a cookie and redirect back to /r
*/
responses.testCookie = function(response, cookieId, request, cookieDuration, cookieContents) {

    request.pathname = '/r';

    // Write out the cookie
    response.writeHead(200, {
        'Set-Cookie': 'sp=' + cookieId + '; expires='+ new Date(new Date().getTime()+cookieDuration).toUTCString() + ';' + cookieContents,
        'P3P': 'policyref="/w3c/p3p.xml", CP="NOI DSP COR NID PSA OUR IND COM NAV STA"',
        'Location': request
    });
    // Send pixel
    response.end(imageBuffer);
}

/**
 * Respond with server status.
 * Using measured library
 */
responses.sendStatus = function(response, hostname, collector, numCPUs, monitoring) {

    var status = monitoring.stats.toJSON();
    status.memoryUsage = monitoring.memory.toJSON();
    status.uptime = monitoring.uptime.toJSON();
    status.hostname = hostname;
    status.collector = collector;
    status.numCPUs = numCPUs;

    response.writeHead(200, {"Content-Type": "application/json"});
    response.write(JSON.stringify(status));
    response.end();
}

/**
 * All important export of responses.
 */
module.exports = responses;