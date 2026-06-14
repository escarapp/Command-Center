declare module "shpjs" {
  // Minimal typing to satisfy our usage (zipped shapefile ArrayBuffer -> GeoJSON)
  const shp: (data: ArrayBuffer) => Promise<any>;
  export default shp;
}
