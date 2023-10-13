#!/bin/bash
docker run --rm -it -v $(pwd)/data/mbtiles:/data -p 8080:8080 maptiler/tileserver-gl --mbtiles=./algonquin.mbtiles
