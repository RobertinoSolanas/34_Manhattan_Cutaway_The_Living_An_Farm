#!/bin/sh
# start the static server in the background if it is not already up
if ! curl -s -o /dev/null http://localhost:5173/ ; then
  cd "$(dirname "$0")/.." || exit 1
  setsid nohup node tools/serve.js 5173 > /tmp/cutaway-serve.log 2>&1 < /dev/null &
  sleep 1.2
fi
curl -s -o /dev/null -w "server=%{http_code}\n" http://localhost:5173/
