#!/bin/sh
VW=1600 VH=900 QUALITY=high node tools/capture.mjs shots > /tmp/final-shots.log 2>&1
SECONDS=75 VW=1152 VH=648 QUALITY=std node tools/capture.mjs video > /tmp/final-video.log 2>&1
ffmpeg -v error -y -i shots/cutaway.mp4 -c:v libx264 -pix_fmt yuv420p -crf 25 -preset slow -movflags +faststart /tmp/cc.mp4 && mv /tmp/cc.mp4 shots/cutaway.mp4
echo DONE > /tmp/final.done
