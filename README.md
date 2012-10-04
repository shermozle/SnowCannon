# SnowCannon

## Introduction

SnowCannon is an event collector server for [SnowPlow] [snowplow], written in node.js by Simon Rumble <simon@simonrumble.com>.

There are three benefits of using SnowCannon over SnowPlow's [CloudFront-based collector] [cloudfront-collector]:

1. Allows use of a third-party cookie, making user tracking across domains possible for all except mobile Safari. This is something even the Google Analytics JS-set cookies approach struggles with
2. Enables real-time analytics, if you want it. CloudFront has 10-20 minute delays to get the logs into S3
3. Supports (via [Fluentd] [fluentd]) saving SnowPlow events to data stores other than Amazon S3 - e.g. Google Storage or Cassandra

## How SnowCannon works

In a nutshell: SnowCannon receives events from the [SnowPlow JavaScript tracker] [snowplow-js], sets/updates a third-party user tracking cookie, and logs the events in gzipped files to Amazon S3.

In pseudocode terms:

	if (request contains an "sp" cookie) {
	    Record that cookie as the user identifier
	    Set that cookie with a now+1 year cookie expiry
	    Add the headers and payload to the output array
	} else {
	    Set the "sp" cookie with a now+1 year cookie expiry
	    Add the headers and payload to the output array
	}
	Every 10 minutes, push the data out to S3 as a gzipped JSON file

## Dependencies

SnowCannon depends on the following NPM packages:

* [cluster] [cluster], creates workers to exploit multi-core servers
* [knox] [knox], an Amazon S3 library
* [node-uuid] [node-uuid], generates UUIDs for user tracking
* [measured] [measured], for SnowCannon performance metrics
* [fluent-logger] [fluent-logger], for logging events to [Fluentd] [fluentd]

Note that _using_ Fluentd or Knox for logging is optional - but the dependencies are required.

## Getting started

First, you need to [install Node.js] [node-install].

Now checkout and install SnowCannon:

	$ git clone git://github.com/shermozle/SnowCannon.git
	$ cd SnowCannon
    $ npm install .

And finally run it:

    $ node snowcannon.js

If you are using the default HTTP port 80, you may need to run node using `sudo` (and potentially supply the full path to your node binary).

## Testing

You can run a manual check on SnowCannon by loading the following web page in your web browser:

    tests/manual/async.html

To check this is working:

1. Use e.g. Chrome Developer Tools to check that `ice.png` is being successfully fetched from your SnowCannon instance running on `http://localhost`.
2. Check that your events are being printed to `stdout` in your terminal running SnowCannon

## Configuring your event sink

SnowCannon supports three different event sinks:

1. **stdout** - events (and only events) are printed to `stdout`. Use your process control system (e.g. supervisord or daemontools) to handle the `stdout` eventstream (e.g. uploading it to S3 or Google Storage). Also useful for debugging
2. **s3** - events are collected by SnowCannon, and then regularly gzipped and uploaded to S3 by SnowCannon itself
3. **fluentd** - events are sent by SnowCannon to [Fluentd] [fluentd], a lightweight log collector. Configure Fluentd to forward the events on to S3, Google Storage or equivalent

You can configure your event sink in the `config.js` file - to take each sink option in turn:

### stdout

SnowCannon's event sink is set to **stdout** by default - you don't need to change anything to use this sink.

### s3

To change the event sink to **s3**, set the `config.sink.out` variable like so:

```javascript
config.sink.out = "s3";
```

And then update the following configuration section:

```javascript
// S3 bucket name
config.sink.s3.bucket = 'S3 BUCKET NAME GOES HERE';

// AWS access details
config.sink.s3.key = process.env.AWS_ACCESS_KEY_ID || 'KEY GOES HERE IF ENV NOT SET';
config.sink.s3.secret = process.env.AWS_SECRET_KEY || 'SECRET GOES HERE IF ENV NOT SET';
```

Note that you do not have to add your AWS access details into this file if they are already available to node.js in your shell environment.

### fluentd

To change the event sink to **fluentd**, set the `config.sink.out` variable like so:

```javascript
config.sink.out = "fluentd";
```

Depending on how you have configured Fluentd is configured, you should be able to leave the `config.sink.fluentd` variables untouched - they correspond to the Fluentd default configuration found in:

    etc/fluentd/fluent.conf

Please note that setting up and configuring Fluentd is out of scope of this README - but the SnowPlow team has included instructions on this as part of their [SnowCannon Setup Guide] [snowcannon-setup-guide].

## Performance

Tested on an Amazon EC2 Small with Siege, SnowCannon handles up to about 10,000 concurrent requests a second before it starts dropping connections.

## Deploying to production

When deploying node.js apps to production, it is [generally recommended] [node-js-deployment] that you additionally setup:

1. A **service wrapper** - e.g. [Upstart] [upstart] or [Forever] [forever]. A service wrapper runs SnowCannon in a separate process and restarts SnowCannon if it dies
2. A **process monitor** - e.g. [Monit] [monit] or [God] [god]. A utility for monitoring and managing processes; use it to send a simple HTTP request to SnowCannon and restart SnowCannon if it does not respond

Setting up a service wrapper and process monitor is out of scope of this README; however the SnowPlow team will be including instructions on setting up **Upstart** and **Monit** as part of their [SnowCannon Setup Guide] [snowcannon-setup-guide]. In the meantime, default Upstart and Monit configuration files can be found here:

    etc/monit/monit.conf
    etc/upstart/snowcannon.conf

## Roadmap

* Work on supporting infrastructure of auto-scaling and load balancing

## Copyright and license

SnowCannon is copyright 2012 Simon Rumble <simon@simonrumble.com>.

Licensed under the [Apache License, Version 2.0] [license] (the "License");
you may not use this software except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

[snowplow]: http://snowplowanalytics.com
[snowplow-js]: https://github.com/snowplow/snowplow/tree/master/1-trackers/javascript
[cloudfront-collector]: https://github.com/snowplow/snowplow/tree/master/2-collectors/cloudfront-collector
[knox]: https://github.com/learnboost/knox
[node-uuid]: https://github.com/broofa/node-uuid
[cluster]: https://npmjs.org/package/cluster
[measured]: https://npmjs.org/package/measured
[license]: http://www.apache.org/licenses/LICENSE-2.0
[node-install]: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
[fluentd]: http://fluentd.org/
[fluent-logger]: https://github.com/yssk22/fluent-logger-node
[snowcannon-setup-guide]: https://github.com/snowplow/snowplow/wiki/SnowCannon-setup-guide
[node-js-deployment]: http://stackoverflow.com/questions/4681067/how-to-deploy-node-js
[forever]: https://github.com/nodejitsu/forever
[upstart]: http://upstart.ubuntu.com/
[monit]: http://mmonit.com/monit/
[god]: http://godrb.com/