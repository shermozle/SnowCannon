SnowCannon
==========

Node.js web analytics data collection server. Logs web analytics beacons
to gzipped files in S3.

By Simon Rumble <simon@simonrumble.com>

Dependencies
------------

Depends on the following NPM packages:
    npm install knox node-uuid

Getting started
---------------

* [Install NodeJS](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)
* Install the dependent modules
    npm install knox node-uuid
* Plug your S3 credentials and a bucket name into the config section
* Run it:
    nodejs snowcannon.js