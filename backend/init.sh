#!/bin/ash
export $(cat /srv/.env | grep -v ^# | xargs); ./bin/main