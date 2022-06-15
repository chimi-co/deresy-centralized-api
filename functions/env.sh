#!/bin/bash

 
if [ $1 == "dev" ]; then  
  firebase use development
  firebase functions:config:set settings="$(cat .env.development.json)"
fi

if [ $1 == "staging" ]; then  
  firebase use staging
  firebase functions:config:set settings="$(cat .env.staging.json)"
fi

if [ $1 == "prod" ]; then  
  firebase use production
  firebase functions:config:set settings="$(cat .env.production.json)"
fi