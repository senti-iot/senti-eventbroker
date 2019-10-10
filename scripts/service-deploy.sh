#!/bin/bash

if [[ "$1" == "master" ]]; then
	echo
	echo Deploying Senti Event Broker $1 ...
	rsync -r --quiet $2/ deploy@rey.webhouse.net:/srv/nodejs/senti/services/eventbroker/production
	echo
	echo Restarting Senti Event Broker service: $1 ...
	ssh deploy@rey.webhouse.net 'sudo /srv/nodejs/senti/services/eventbroker/production/scripts/service-restart.sh master'
	echo
	echo Deployment to Senti Event Broker $1 and restart done!
	exit 0
fi

if [[ "$1" == "dev" ]]; then
	echo
	echo Deploying Senti Event Broker $1 ...
	rsync -r --quiet $2/ deploy@rey.webhouse.net:/srv/nodejs/senti/services/eventbroker/development
	echo
	echo Restarting Senti Event Broker service: $1 ...
	ssh deploy@rey.webhouse.net 'sudo /srv/nodejs/senti/services/eventbroker/development/scripts/service-restart.sh dev'
	echo
	echo Deployment to Senti Event Broker $1 and restart done!
	exit 0
fi