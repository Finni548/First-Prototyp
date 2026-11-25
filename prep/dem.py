# DHM25/200 (swisstopo) -> js/terrain-dem.js : Höhen in Grad-Raster, Uint16 (dm-genau egal: Meter), base64
import sys, zipfile, io, numpy as np, base64, glob, os
from pyproj import Transformer
src = sys.argv[1]
z = zipfile.ZipFile(src)
names = z.namelist(); print(names)
asc = [n for n in names if n.lower().endswith(".asc")]
if asc:
    raw = z.read(asc[0]).decode("latin1").splitlines()
    hdr = {}; i = 0
    while raw[i].split()[0].lower() in ("ncols","nrows","xllcorner","yllcorner","xllcenter","yllcenter","cellsize","nodata_value"):
        k, v = raw[i].split()[:2]; hdr[k.lower()] = float(v); i += 1
    A = np.loadtxt(io.StringIO("\n".join(raw[i:])), dtype=np.float32)
    nc, nr, cs = int(hdr["ncols"]), int(hdr["nrows"]), hdr["cellsize"]
    x0 = hdr.get("xllcorner", hdr.get("xllcenter", 0) - cs/2); y0 = hdr.get("yllcorner", hdr.get("yllcenter", 0) - cs/2)
    nod = hdr.get("nodata_value", -9999)
else:
    import rasterio
    tif = [n for n in names if n.lower().endswith((".tif",".tiff"))][0]
    z.extract(tif, "/tmp/dem"); r = rasterio.open("/tmp/dem/"+tif)
    A = r.read(1).astype(np.float32); nr, nc = A.shape; cs = r.transform.a; x0 = r.transform.c; y0 = r.transform.f - nr*cs; nod = r.nodata
print("grid", nc, nr, cs, x0, y0, A.min(), A.max())
crs = 21781 if x0 < 1e6 else 2056
A[A == nod] = np.nan
# Zielraster (gleiches Gebiet wie SWISS_TERRAIN)
LON0, LON1, LAT0, LAT1 = 5.9, 10.55, 45.78, 47.84
NX, NY = int(sys.argv[2]) if len(sys.argv) > 2 else 1400, 0
NY = int(round(NX * (LAT1-LAT0)*111 / ((LON1-LON0)*111*np.cos(np.radians(46.8)))))
lons = np.linspace(LON0, LON1, NX); lats = np.linspace(LAT1, LAT0, NY)
LO, LA = np.meshgrid(lons, lats)
tr = Transformer.from_crs(4326, crs, always_xy=True)
X, Y = tr.transform(LO, LA)
fc = (X - x0) / cs - 0.5; fr = (y0 + nr*cs - Y) / cs - 0.5
c0 = np.clip(np.floor(fc).astype(int), 0, nc-2); r0 = np.clip(np.floor(fr).astype(int), 0, nr-2)
u = np.clip(fc - c0, 0, 1); v = np.clip(fr - r0, 0, 1)
def g(rr, cc): return A[rr, cc]
H = g(r0,c0)*(1-u)*(1-v) + g(r0,c0+1)*u*(1-v) + g(r0+1,c0)*(1-u)*v + g(r0+1,c0+1)*u*v
inside = (fc >= 0) & (fc < nc-1) & (fr >= 0) & (fr < nr-1)
H[~inside] = np.nan
valid = ~np.isnan(H)
print("target", NX, NY, "valid", valid.mean())
H16 = np.where(valid, np.clip(np.round(H), 1, 65000), 0).astype("<u2")
b = base64.b64encode(H16.tobytes()).decode()
js = ("/* Echtes Höhenmodell der Schweiz: swisstopo DHM25/200 (Open Data, Quelle: swisstopo).\n"
      "   Auf ein Grad-Raster umgerechnet (prep/dem.py). 0 = keine Daten (ausserhalb CH). */\n"
      f"window.SWISS_DEM = {{\"nx\":{NX},\"ny\":{NY},\"lon0\":{LON0},\"lon1\":{LON1},\"lat0\":{LAT0},\"lat1\":{LAT1},\"h\":\"{b}\"}};\n")
open("/home/claude/v2/js/terrain-dem.js", "w").write(js)
print("MB", len(js)/1e6)
