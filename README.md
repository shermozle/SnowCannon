# SnowCannon

## Introduction

SnowCannon is a Node.js web analytics data collection server for [SnowPlow] [snowplow], by Simon Rumble <simon@simonrumble.com>.

There are two benefits of using SnowCannon over SnowPlow's existing CloudFront-based collector:

1. Allows use of a third-party cookie, making tracking across domains possible for all except mobile Safari. This is something even the Google Analytics JS-set cookies approach struggles with
2. Enables real-time analytics, if you want it. CloudFront has 10-20 minute delays to get the logs into S3

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

* [knox] [knox], an Amazon S3 library
* [node-uuid] [node-uuid], generates UUIDs for user tracking

## Getting started

First, you need to [install Node.js] [node-install].

Next, install the dependent modules:

    $ npm install knox node-uuid

Plug your S3 credentials and a bucket name into the config section:

```javascript
logBucket: {
		key: 'KEY GOES HERE',
		secret: 'SECRET GOES HERE',
		bucket: 'S3 BUCKET NAME GOES HERE'
	},
```

And finally run it:

    $ node snowcannon.js

If you are using the default HTTP port 80, you may need to run node using `sudo` (and potentially the full path to your node binary).

## Testing

You can run a manual check on SnowCannon by loading the following web page in your web browser:

    tests/manual/async.html

Use e.g. Chrome Developer Tools to check that `ice.png` is being successfully fetched from your SnowCannon instance running on `http://localhost`.

## Performance

Tested on an Amazon EC2 Small with Siege, SnowCannon handles up to about 10,000 concurrent requests a second before it starts dropping connections.

## Roadmap

* Update the output format
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
[knox]: https://github.com/learnboost/knox
[node-uuid]: https://github.com/broofa/node-uuid
[license]: http://www.apache.org/licenses/LICENSE-2.0
[node-install]: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager