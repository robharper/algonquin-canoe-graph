

const init = function() {
  let protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  var map = new maplibregl.Map({
    container: 'map',
    style: '/style.json',
    center: [-78.4875, 45.699], // starting position [lng, lat]
    zoom: 10, // starting zoom
    minZoom: 8
  });
};


init();