#!/bin/bash


SOURCE=${BASH_SOURCE[0]}
while [ -L "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )
  SOURCE=$(readlink "$SOURCE")
  [[ $SOURCE != /* ]] && SOURCE=$DIR/$SOURCE # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )


export CGO_ENABLED=0 
export GOOS=linux
export GOARCH=amd64
CACHE_ROOT=$DIR/../../docker/mount/cache/
export GOPATH=$CACHE_ROOT/go-mod
export GOCACHE=$CACHE_ROOT/go-cache


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