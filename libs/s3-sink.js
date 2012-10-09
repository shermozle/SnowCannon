var uuid = require('node-uuid');
var knox = require('knox');
var zlib = require('zlib');
var os = require("os");

var s3Sink = {};

// To identify this server's files.
if (os.hostname()) {
	uniqueName = os.hostname();
} else {
	uniqueName = uuid.v4();
}

// Log file array for S3
var s3Log = "";

/**
 * "Logs" an event by pushing it to our s3Log array
 */ 
s3Sink.log = function(event) {
	if (s3Log !== "") {
		s3Log += "\n";
	}
	s3Log += event;	
}

/**
 * Gzips and uploads our s3Log array to S3.
 */
s3Sink.upload = function(config) {
	if (s3Log.length > 0) {
		var client = knox.createClient(config);
		// TODO: is this a race condition?
		console.log('Sending ' + s3Log.split("\n").length + ' events to S3 ' + uniqueName);
		var outputLog = s3Log;
		s3Log = [];

		// Gzip the output
		zlib.gzip(outputLog, function(err, buffer) {
			if (!err) {
				var date = new Date();
				var req = client.put(uniqueName + '-' + date.toISOString() + '.json.gz', {
					'Content-Length': buffer.length,
			 		'Content-Type': 'application/gzip'
				});

				req.on('response', function(res){
					if (200 == res.statusCode) {
						console.log('Saved to %s', req.url);
		 			} else {
		 				console.error('Saving to S3 failed statusCode: ' + res.statusCode)
		 			}
				});
				req.on('error', function(err){
				    console.error("S3 error: " +  err);
				});
				req.end(buffer);
			}
		});
	}
}

/**
 * All important export of s3Sink.
 */
module.exports = s3Sink;