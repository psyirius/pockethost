#!/bin/bash

CGO_ENABLED=0 
GOOS=linux
GOARCH=amd64
CACHE_ROOT=../../docker/mount/cache/
GOPATH=$CACHE_ROOT/go-mod
GOCACHE=$CACHE_ROOT/go-cache

SRC=src
TARGET=build/$PLATFORM/$VERSION
DIST=./dist
rm -rf $TARGET
mkdir -p $TARGET
mkdir -p $DIST
cp -r $SRC/* $TARGET
echo `pwd`
cd $TARGET
echo "Building ${BIN}"
echo "Fetching pocketbase version $VERSION"
go get github.com/pocketbase/pocketbase@v$VERSION
echo "Tidying modules"
go mod tidy
echo "Building ${BIN}"
go build -o ../../../$DIST/$BIN
echo "Build ${BIN} complete" `date`