# FeatureService Replicator
A small express app that wraps the feature service createReplica API

## Usage
```
NPM install
node server.js
curl localhost:3000/:opendata_id
````

Will return 202 until the file is ready, then it will return the file geodatabase

Note: The Feature Service must have sync enabled

## Architecture
![image](https://raw.githubusercontent.com/dmfenton/featureservice-replicator/master/architecture.jpg)

