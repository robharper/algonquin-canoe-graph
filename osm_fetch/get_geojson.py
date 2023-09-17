import os
import subprocess
import json
import geojson
import osm2geojson

from urllib.request import urlopen

URL = "http://overpass-api.de/api/interpreter"
CWD = os.path.dirname(os.path.realpath(__file__))
print(CWD)

QUERY_PORTAGES = """
    area(id:3600910784)->.searchArea;
    (
    way[canoe=portage](area.searchArea);
    );
    """
QUERY_RIVERS = """
    area(id:3600910784)->.searchArea;
    (
    way[waterway~"^(river|stream)$"](area.searchArea);
    );
    """
QUERY_CAMPSITES = """
    area(id:3600910784)->.searchArea;
    (
    nwr[tourism=camp_site](area.searchArea);
    );
    """
QUERY_LAKES = """
    area(id:3600910784)->.searchArea;
    (
    nwr[natural=water](area.searchArea);
    );
    """

LAYERS = [
    {
        "query": QUERY_PORTAGES,
        "name": "portages"
    },
    {
        "query": QUERY_RIVERS,
        "name": "rivers"
    },
    {
        "query": QUERY_CAMPSITES,
        "name": "campsites"
    },
    {
        "query": QUERY_LAKES,
        "name": "lakes"
    }
]

def query(overpass_query):
    query_str = f"[out:json]; {overpass_query} out geom;"
    f = urlopen(URL, query_str.encode("utf-8"))
    result = f.read()
    f.close()
    if f.code == 200:
        return result.decode("utf-8")

def is_same(pt1, pt2):
    return pt1["lat"] == pt2["lat"] and pt1["lon"] == pt2["lon"]

# Merge features with matching ends
def chain_geometry(geometry, reverse=False):
    merge_fails_left = len(geometry)
    while len(geometry) > 1:
        head = geometry.pop(0)
        tail = None
        for segment in geometry:
            if is_same(head["geometry"][0 if reverse else -1], segment["geometry"][0]):
                tail = segment
                break

        geometry.append(head)

        if tail:
            geometry.remove(tail)
            if reverse:
                tail["geometry"].reverse()
            head["geometry"] += tail["geometry"]
        else:
            merge_fails_left -= 1
            if merge_fails_left == 0:
                break
    return geometry

def fix_osm(data):
    """
    osm2geojson fails for most multi-polygons, so we need to convert them to single polygons and
    drop all inner cuts (islands in lakes)

    There are three merge steps:
    1. Merge all outer members where the first and last points are the same
    2. Separate out all self-enclosed areas (multi-areas)
    3. Merge all fragments (non-self-enclosed areas) where the first points are the same, reversing one of the fragments
    """
    new_features = []

    for feature in data["elements"]:
        if feature["type"] == "relation":
            outer_features = list(filter(lambda m: m["role"] == "outer", feature["members"]))
            # Inner features tend to fail to convert to geojson
            #inner_features = list(filter(lambda m: m["role"] == "inner", feature["members"]))

            if len(outer_features) > 1:
                # Merge outer members
                outer_features = chain_geometry(outer_features)

            if len(outer_features) > 1:
                # Either a multi-area polygon (two self-enclosed areas) or a multi-polygon without exact matching ends
                # Add all multi-areas as separate features
                output_features = list(filter(lambda m: is_same(m["geometry"][0], m["geometry"][-1]), outer_features))

                # Merge fragments
                fragments = list(filter(lambda m: not is_same(m["geometry"][0], m["geometry"][-1]), outer_features))
                # Fragments appear to fail merge above due to reversed order geometry
                fragments = chain_geometry(fragments, reverse=True)
                output_features += fragments

                # Add all multi-areas as separate features
                feature["members"] = [output_features[0]]
                for outer_feature in output_features[1:]:
                    new_feature = feature.copy()
                    new_feature["members"] = [outer_feature]
                    new_features.append(new_feature)
            else:
                feature["members"] = outer_features

    data["elements"] += new_features

    return data

for layer in LAYERS:
    print("--------------------")
    print(f"Processing {layer['name']}...")

    # Online query for geojson, only if the file doesn't exist
    osm_filename = f"{CWD}/geojson/{layer['name']}.osm.json"
    osm_data = None
    if not os.path.exists(osm_filename):
        print("Querying Overpass API...")
        with open(osm_filename, mode="w") as f:
            result = query(layer["query"])
            f.write(result)
            osm_data = json.loads(result)
    else:
        print(f"Found {osm_filename}...")
        osm_data = json.load(open(osm_filename))

    # Convert osm to geojson, only if the file doesn't exist
    geojson_filename = f"{CWD}/geojson/{layer['name']}.geo.json"
    if not os.path.exists(geojson_filename):
        osm_data = fix_osm(osm_data)
        gj = osm2geojson.json2geojson(osm_data)
        with open(geojson_filename, mode="w") as f:
            geojson.dump(gj,f)

    # Convert to mbiles
    return_code = subprocess.call([
        "tippecanoe",
        f"-L{layer['name']}:{geojson_filename}",
        "--force",
        "--projection=EPSG:4326",
        "-Z8", "-z14",
        f"-o./mbtiles/{layer['name']}.mbtiles",
        ],
        stdout=subprocess.PIPE,
        universal_newlines=True,
        cwd=CWD
    )

    if return_code != 0:
        print(f"Error: tippecanoe returned {return_code}")
        exit(return_code)
    else:
        print("Success!")

# Merge all layers into one mbtiles
return_code = subprocess.call([
    "tile-join",
    "-oalgonquin.mbtiles",
    "-n algonquin",
    "-pk", # Don't skip big tiles
    "--force",
    ] + [f"./mbtiles/{layer['name']}.mbtiles" for layer in LAYERS],
    stdout=subprocess.PIPE,
    universal_newlines=True,
    cwd=CWD)

if return_code != 0:
    print(f"Error: merging layers with tippecanoe tile-join returned {return_code}")
    exit(return_code)
else:
    print("Successfully merged layers!")

