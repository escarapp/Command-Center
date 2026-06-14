import JSZip from "jszip";
import shp from "shpjs";
import { kml as kmlToGeojson } from "@tmcw/togeojson";

function fileExtLower(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

function toFeatureCollection(geojson: any): GeoJSON.FeatureCollection {
  if (!geojson) throw new Error("Empty GeoJSON");

  if (geojson.type === "FeatureCollection") {
    return geojson as GeoJSON.FeatureCollection;
  }

  if (geojson.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [geojson as GeoJSON.Feature],
    };
  }

  if (geojson.type && geojson.coordinates) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: geojson as GeoJSON.Geometry,
        },
      ],
    };
  }

  throw new Error("Unsupported GeoJSON input");
}

export async function parseGeoFileToFeatureCollection(file: File): Promise<GeoJSON.FeatureCollection> {
  const ext = fileExtLower(file.name);

  if (ext === "geojson" || ext === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return toFeatureCollection(parsed);
  }

  if (ext === "kml") {
    const text = await file.text();
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const gj = kmlToGeojson(xml);
    return toFeatureCollection(gj);
  }

  if (ext === "kmz") {
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);

    const kmlNames = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith(".kml"));
    if (kmlNames.length === 0) throw new Error("KMZ did not contain a .kml file");

    // Prefer doc.kml when present
    const preferred = kmlNames.find((n) => n.toLowerCase().endsWith("doc.kml")) ?? kmlNames[0];
    const kmlText = await zip.files[preferred].async("text");
    const xml = new DOMParser().parseFromString(kmlText, "text/xml");
    const gj = kmlToGeojson(xml);
    return toFeatureCollection(gj);
  }

  if (ext === "zip") {
    const ab = await file.arrayBuffer();
    // shpjs supports zipped shapefiles directly
    const gj = await shp(ab);
    return toFeatureCollection(gj);
  }

  throw new Error(`Unsupported file type: .${ext || "(none)"}`);
}

export function iterFeatures(fc: GeoJSON.FeatureCollection): Array<GeoJSON.Feature> {
  return (fc.features ?? []).filter(Boolean) as Array<GeoJSON.Feature>;
}
