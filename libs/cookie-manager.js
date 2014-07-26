var uuid = require('node-uuid');

var cookieManager = {};

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
		cookies.age = 'new';
	}

    return cookies;
}

// Pull together the little bit that goes in the cookie string for the domain

/**
 * Returns the cookie contents given the
 * supplied domain name
 */
cookieManager.getCookieContents = function(domainName) {
	
	if (domainName !== undefined) {
		return 'Domain=' + domainName + ';';
	} else {
		return '';
	}
}

/**
 * All-important export of cookieManager.
 */
module.exports = cookieManager;