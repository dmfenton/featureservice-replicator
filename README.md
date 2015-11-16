# FeatureService Replicator
A small express app that wraps the feature service createReplica API

## Usage
`NPM install`

`localhost:3000/:opendata_id`

Will return 202 until the file is ready, then it will return the file geodatabase

Note: The Feature Service must have sync enabled

