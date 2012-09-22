var config = {};

config.server = {};
config.cookie = {};
config.sink = {};
config.sink.s3 = {};
config.sink.fluentd = {};

/**
 * Server configuration
 */

// HTTP port
config.server.httpPort = 80;

/**
 * Cookie configuration
 */

// Number of milliseconds the cookie will stay around
config.cookie.milliseconds = 31556900000;

// If defined, sets the domain name cookies will be set on.
// Can be a wildcard e.g. '.foo.com'
// If undefined it'll just use the FQDN of the host
config.cookie.domainName = undefined;

/**
 * Which sink will we use for collected events?
 * - s3 means SnowCannon will handle compression and upload to S3 itself
 * - stdout means SnowCannon will log events to stdout. Use your process control system (e.g. supervisord, daemontools, Angel) to handle the stdout eventstream
 * - fluentd means SnowCannon will use Fluentd (http://fluentd.org/) to collect events
 */
config.sink.out = "stdout"; // Or "s3" or "fluentd"

/*
 * S3 configuration
 */

// How often to push data to S3
config.sink.s3.flushSeconds = 600;

// S3 bucket name
config.sink.s3.bucket = 'S3 BUCKET NAME GOES HERE';

// AWS access details
config.sink.s3.key = process.env.AWS_ACCESS_KEY_ID || 'KEY GOES HERE IF ENV NOT SET';
config.sink.s3.secret = process.env.AWS_SECRET_KEY || 'SECRET GOES HERE IF ENV NOT SET';

/**
 * Fluentd configuration
 */

// Host running Fluentd daemon
config.sink.fluentd.host = "localhost";

// Port for Fluentd daemon
config.sink.fluentd.port = 24224;

// Timeout for contacting the Fluentd daemon
config.sink.fluentd.timeout = 3.0;

// What primary tag should we use?
config.sink.fluentd.mainTag = "snowplow";

// What secondary tag should we use?
config.sink.fluentd.subTag = "event"

/**
 * All-important export of config.
 */
module.exports = config;