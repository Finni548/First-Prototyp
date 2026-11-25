import shapefile, csv, json, collections, math
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union
from pyproj import Transformer
D="/mnt/user-data/uploads/Data/"
tr=Transformer.from_crs(2056,4326,always_xy=True)
TOL=25   # m simplification
Q=1e4    # lon/lat quantisation (1e-4 deg ~ 8-11 m)

def polys(path,enc,idf):
    r=shapefile.Reader(D+path,encoding=enc); out=[]
    for sr in r.iterShapeRecords():
        g=shape(sr.shape.__geo_interface__)
        if not g.is_valid: g=g.buffer(0)
        out.append((sr.record[idf], g))
    return out
inv={"1973":polys("inventory_sgi1973_r1976/SGI_1973","latin1","SGI"),
     "2016":polys("inventory_sgi2016_r2020/SGI_2016_glaciers","utf-8","sgi-id"),
     "2023":polys("inventory_sgi2023_r2026/SGI_2023_glaciers","utf-8","sgi-id")}

def enc_ring(coords):
    xs,ys=tr.transform([c[0] for c in coords],[c[1] for c in coords])
    q=[(round(x*Q),round(y*Q)) for x,y in zip(xs,ys)]
    flat=[];px=py=0
    for i,(x,y) in enumerate(q):
        if i and x==px and y==py: continue
        flat+= [x-px,y-py] if i else [x,y]; px,py=x,y
    return flat
encoded={}
for yr,lst in inv.items():
    rings=[]
    for sid,g in lst:
        g=g.simplify(TOL,preserve_topology=True)
        parts=g.geoms if isinstance(g,MultiPolygon) else [g]
        for p in parts:
            if p.is_empty or p.area<500: continue
            rings.append(enc_ring(list(p.exterior.coords)))
            for h in p.interiors:
                if Polygon(h).area>2000: rings.append(enc_ring(list(h.coords)))
    encoded[yr]=rings
    print(yr,len(rings),sum(len(r) for r in rings))

# --- unsere Gletscher ---
ours={"aletsch":"B36-26","gorner":"B56-07","fiescher":"B40-07","unteraar":"A54g-11","oberaletsch":"B36-01",
"findel":"B56-03","corbassiere":"B83-03","rhone":"B43-03","gauli":"A54i-05","trift":"A54e-24","otemma":"B82-27",
"morteratsch":"E22-03","zinal":"B63-05","allalin":"B52-29","plainemorte":"A55f-03","trient":"B90-02","stein":"A54e-12",
"clariden":"A50i-19","tsanfleuron":"B22-01","silvretta":"A10g-05","basodino":"C14-10","birch":"B32-06","pizol":"A50d-01"}
gl={}
for gid,sid in ours.items():
    rec={"sgi":sid}
    for yr,lst in inv.items():
        geoms=[g for s,g in lst if s==sid]
        u=unary_union(geoms) if geoms else None
        rec["a"+yr]=round(u.area/1e6,3) if u else 0
        if yr=="1973" and u:
            x0,y0,x1,y1=u.bounds
            (lo0,la0),(lo1,la1)=[tr.transform(x0,y0),tr.transform(x1,y1)]
            rec["bbox"]=[round(lo0,4),round(la0,4),round(lo1,4),round(la1,4)]
        if yr=="2016" and u:
            c=u.representative_point(); lo,la=tr.transform(c.x,c.y); rec["lon"]=round(lo,4); rec["lat"]=round(la,4)
    if "lon" not in rec:  # Fallback 2023/1973
        for yr in ("2023","1973"):
            geoms=[g for s,g in inv[yr] if s==sid]
            if geoms:
                c=unary_union(geoms).representative_point(); lo,la=tr.transform(c.x,c.y); rec["lon"]=round(lo,4); rec["lat"]=round(la,4); break
    # 3 Bohrstellen im Eis von 2023 (sonst 2016): Punkt tiefst im Eis + 2 weit auseinander
    for yr in ("2023","2016","1973"):
        geoms=[g for s_,g in inv[yr] if s_==sid]
        if geoms: break
    u=unary_union(geoms)
    from shapely.ops import polylabel
    import numpy as np
    big=max(u.geoms,key=lambda p:p.area) if isinstance(u,MultiPolygon) else u
    inner=big.buffer(-min(250,math.sqrt(big.area)/8))
    if inner.is_empty: inner=big
    x0,y0,x1,y1=inner.bounds; step=max(30,(x1-x0+y1-y0)/80)
    from shapely.geometry import Point
    pts=[(x,y) for x in np.arange(x0,x1,step) for y in np.arange(y0,y1,step) if inner.contains(Point(x,y))]
    first=polylabel(big if big.geom_type=="Polygon" else big,tolerance=20); chosen=[(first.x,first.y)]
    for _ in range(2):
        if not pts: break
        best=max(pts,key=lambda p:min((p[0]-c[0])**2+(p[1]-c[1])**2 for c in chosen)); chosen.append(best)
    rec["cores"]=[[round(v,5) for v in tr.transform(*c)] for c in chosen]
    gl[gid]=rec
    print(gid,rec)

# --- Laengenaenderung: kumuliert seit 1970 pro Jahr (Ende Messperiode) ---
lc=collections.defaultdict(dict)
with open(D+"lengthchange_2025_r2025.csv",encoding="utf-8") as f:
    rows=[r for r in csv.reader(f)]
hdr=[i for i,r in enumerate(rows) if r and r[0]=="glacier name"][0]
for r in rows[hdr+3:]:
    if len(r)<7 or not r[1]: continue
    sid=r[1]
    if sid not in ours.values(): continue
    try: dl=float(r[6]); y0=int(r[2][:4]); y1=int(r[4][:4])
    except: continue
    if y1<=1970: continue
    # Perioden ueber mehrere Jahre gleichmaessig verteilen
    span=max(1,y1-max(y0,1970))
    for y in range(max(y0,1970)+1,y1+1):
        lc[sid][y]=lc[sid].get(y,0)+dl/span
length={}
for gid,sid in ours.items():
    if sid not in lc: continue
    ys=sorted(lc[sid]); cum=0; ser={}
    for y in range(1971,max(ys)+1):
        cum+=lc[sid].get(y,0); ser[y]=round(cum)
    length[gid]={"from":1971,"to":max(ys),"cum":[ser[y] for y in range(1971,max(ys)+1)],"gaps":sum(1 for y in range(1971,max(ys)+1) if y not in lc[sid])}
    print(gid,"length",ser[max(ys)],"last",max(ys),"gaps",length[gid]["gaps"])

# --- Swisswide ---
vol={};area={};chg={}
with open(D+"massbalance_swisswide_2025_r2025.csv",encoding="utf-8") as f:
    for r in csv.reader(f):
        if r and r[0]=="Switzerland":
            y=int(r[1]); vol[y]=float(r[4]); area[y]=float(r[2]); chg[y]=None if r[5]=="None" else float(r[5])
vol={y:v for y,v in vol.items() if y>=1970}; area={y:v for y,v in area.items() if y>=1970}; chg={y:v for y,v in chg.items() if y>=1970}

# --- verschwundene Gletscher ---
with open(D+"vanishedglaciers_sgi1973-sgi2016_r2025/vanishedglaciers_sgi1973-sgi2016_r2025.csv") as f:
    vr=list(csv.DictReader(f))
van_big=len({x["SGI"] for x in vr if x["vanished"]=="true" and x["small"]=="false"})
van_all=len({x["SGI"] for x in vr if x["vanished"]=="true"})
van_area=round(sum(float(x["area_km2"]) for x in vr if x["vanished"]=="true"),1)
print("vanished",van_big,van_all,van_area)

out={"vol":vol,"area":area,"chg":chg,"vanished":{"count":van_big,"countAll":van_all,"area":van_area},
     "glaciers":gl,"length":length,"inv":encoded,"Q":Q}
js="/* Echte GLAMOS-Daten, automatisch erzeugt aus dem Ordner \"Data\" (prep/build.py).\n   Quellen: GLAMOS Swisswide Mass Balance r2025, SGI 1973 / 2016 / 2023, Vanished Glaciers r2025, Length Change r2025.\n   Umrisse vereinfacht (25 m) und in Grad (x1e4, Delta-kodiert). */\nwindow.GLAMOS = "+json.dumps(out,separators=(",",":"))+";\n"
open("/home/claude/v2/js/glamos.js","w").write(js)
print("size",len(js)/1e6,"MB")
