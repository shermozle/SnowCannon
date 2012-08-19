var uuid = require('node-uuid');

var cookieManager = {};

// Pull together the little bit that goes in the cookie string for the domain
cookieManager.cookieContents = if (config.cookie.domainName !== undefined) {
	'Domain=' + config.cookie.domainName + ';';
} else {
	'';
}

/**
 * Returns the cookies broken out
 */
cookieManager.getCookies = function(headers) {

	var cookies = {};

  	headers.cookie && headers.cookie.split(';').forEach(function( cookie ) {
    	var parts = cookie.split('=');
    	cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
  	});

  	// If there's no "sp" cookie, create a UUID for it
	if (cookies.sp === undefined) {
		cookies.sp = uuid.v4();
	}

    return cookies;
}

/**
 * All-important export of s3Sink.
 */
module.exports = cookieManager;

