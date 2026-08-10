
import csv, io, re, time
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from PIL import Image

ENTRADA="productos.txt"
SALIDA="resultados_productos.csv"
FALTANTES="productos_sin_5_imagenes.csv"
CARPETA=Path("productos_encontrados")
MAX_IMG=5
DESCARGAR_IMAGENES=False
MODO_RAPIDO=True
USAR_BUSQUEDA_IMAGENES=False
SOLO_PACIFIKO=True
MIN_W=180
MIN_H=180
HEADERS={"User-Agent":"Mozilla/5.0","Accept-Language":"es-GT,es;q=0.9,en;q=0.7"}
MARCAS={"REMIN":"Remington","BD":"Black+Decker","PICCA":"PICCA","CHEF CHEF":"Chef Chef"}
MARCA_QUERIES={
    "REMINGTON": ["remington", "remingtonlatam", "remingtonlatinoamerica"],
    "BLACKDECKER": ["black+decker", "black and decker", "blackanddecker"],
    "PICCA": ["picca"],
    "CHEFCHEF": ["chef chef", "chefchef"],
}

MARCA_CATEGORIA={
    "REMIN": "Remington",
    "BD": "Black&Decker",
    "PICCA": "PICCA",
    "CHEF CHEF": "Chef Chef",
}

MAX_TEXT_RESULTS_POR_QUERY = 4 if MODO_RAPIDO else 12
MAX_CANDIDATOS_ANALIZAR = 10 if MODO_RAPIDO else 30
MAX_IMAGE_RESULTS_POR_QUERY = 20 if MODO_RAPIDO else 70
MAX_HTML_TEXT = 12000 if MODO_RAPIDO else 60000

RUIDO_TOKENS = (
    "busca tu producto", "accesorios", "electromenor", "televisores", "linea blanca",
    "climatizacion", "cuidado personal", "consumibles", "repuestos", "proyectores",
    "categorias", "categoria", "menu", "inicio", "tiendas", "sucursales", "blog",
    "newsletter", "terminos", "politica", "privacidad", "contacto", "carrito",
    "agregar al carrito", "comprar ahora", "whatsapp", "facebook", "instagram", "youtube"
)

COMBO_TOKENS = ("combo", "pack", "kit", "duo", "x2", "2 en 1", "3 en 1")

def limpiar(x): return re.sub(r"\s+"," ",str(x or "").replace("\\|","|")).strip()
def dom(u):
    try:return urlparse(u).netloc.lower().replace("www.","")
    except:return ""
def seguro(x): return re.sub(r'[<>:"/\\|?*]',"_",limpiar(x)).strip()[:100] or "SIN_CODIGO"
def nc(x): return re.sub(r"[^A-Z0-9]","",x.upper())

def es_ruido_texto(t):
    tx=limpiar(t).lower()
    if not tx: return True
    if len(tx)<8: return True
    if any(k in tx for k in RUIDO_TOKENS): return True
    if tx.count("|")>=2: return True
    return False

def dedupe_textos(items, max_items=12):
    out=[]; seen=set()
    for it in items:
        t=limpiar(it)
        if not t: continue
        k=nc(t)
        if not k or k in seen: continue
        seen.add(k); out.append(t)
        if len(out)>=max_items: break
    return out

def es_combo_texto(t):
    tx=limpiar(t).lower()
    if any(k in tx for k in COMBO_TOKENS): return True
    # Detecta patrones tipo "productoA + productoB"
    if re.search(r"[a-z0-9]\s*\+\s*[a-z0-9]", tx): return True
    return False

def parsear(s):
    o=limpiar(s); up=o.upper()
    for a,m in MARCAS.items():
        if up==a or up.startswith(a+" "):
            r=o[len(a):].strip()
            if a=="CHEF CHEF": return {"original":o,"marca":m,"codigo":"","pista":r}
            p=r.split(" ",1); c=p[0]; pista=p[1] if len(p)>1 else ""
            if "|" in c:
                c,e=c.split("|",1); pista=limpiar(e+" "+pista)
            return {"original":o,"marca":m,"codigo":c,"pista":pista}
    p=o.split(" ",1)
    if re.search(r"\d",p[0]): return {"original":o,"marca":"","codigo":p[0],"pista":p[1] if len(p)>1 else ""}
    return {"original":o,"marca":"","codigo":"","pista":o}

def categoria_para(marca):
    return MARCA_CATEGORIA.get(nc(marca), limpiar(marca))

def buscar_texto(p):
    c,m,pi=p["codigo"],p["marca"],p["pista"]
    qs=[]
    if c:
        qs += [
            f'site:pacifiko.com "{c}"',
            f'site:pacifiko.com "{c}" "{m}"',
            f'site:pacifiko.com "{c}" {pi}'
        ]
    else:
        qs += [f'site:pacifiko.com "{p["original"]}"']

    if m:
        marca_key = nc(m)
        marca_terms = MARCA_QUERIES.get(marca_key, [m.lower()])
        for term in marca_terms:
            if c:
                qs += [
                    f'"{c}" "{term}"',
                    f'"{term}" "{c}"',
                    f'"{term}" {pi}'.strip(),
                ]
            else:
                qs += [f'"{term}" "{p["original"]}"']

    out=[]; seen=set()
    with DDGS(timeout=12 if MODO_RAPIDO else 18) as d:
        for q in qs:
            try: rs=d.text(q,region="wt-wt",safesearch="moderate",max_results=MAX_TEXT_RESULTS_POR_QUERY)
            except: continue
            for r in rs or []:
                u=r.get("href") or r.get("url") or ""
                if u and u not in seen:
                    d=dom(u)
                    if SOLO_PACIFIKO and "pacifiko.com" not in d:
                        continue
                    seen.add(u); out.append({"q":q,"title":limpiar(r.get("title")),"body":limpiar(r.get("body")),"url":u,"domain":d})
    return out[:MAX_CANDIDATOS_ANALIZAR]

def analizar(u):
    try:
        r=requests.get(u,headers=HEADERS,timeout=10 if MODO_RAPIDO else 18,allow_redirects=True); r.raise_for_status()
        soup=BeautifulSoup(r.text,"html.parser")
        h1=soup.find("h1")
        titulo=limpiar(h1.get_text(" ",strip=True)) if h1 else limpiar(soup.title.get_text(" ",strip=True) if soup.title else "")
        meta=soup.find("meta",attrs={"name":"description"}); desc=limpiar(meta.get("content")) if meta else ""
        specs=[]
        for tr in soup.select("table tr"):
            c=[limpiar(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]; c=[x for x in c if x]
            if len(c)>=2 and len(c[0])<80 and len(c[1])<250 and not es_ruido_texto(c[0]) and not es_ruido_texto(c[1]):
                specs.append((c[0],c[1]))
        for dt in soup.select("dl dt"):
            dd=dt.find_next_sibling("dd")
            if not dd: continue
            k=limpiar(dt.get_text(" ",strip=True)); v=limpiar(dd.get_text(" ",strip=True))
            if k and v and len(k)<80 and len(v)<250 and not es_ruido_texto(k) and not es_ruido_texto(v):
                specs.append((k,v))
        bullets=[]
        for li in soup.select("main li, article li, section li"):
            if li.find_parent(["header","footer","nav"]):
                continue
            t=limpiar(li.get_text(" ",strip=True))
            if 12<=len(t)<=180 and not es_ruido_texto(t):
                bullets.append(t)
            if len(bullets)>=15: break
        bullets=dedupe_textos(bullets, max_items=12)

        parrafos=[]
        for p in soup.select("main p, article p, section p"):
            if p.find_parent(["header","footer","nav"]):
                continue
            t=limpiar(p.get_text(" ",strip=True))
            if 45<=len(t)<=420 and not es_ruido_texto(t):
                parrafos.append(t)
            if len(parrafos)>=6: break
        parrafos=dedupe_textos(parrafos, max_items=4)

        if not desc and parrafos:
            desc=parrafos[0]

        imgs=[]
        for tag in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
            if tag.get("content"): imgs.append(urljoin(r.url,tag["content"]))
        for im in soup.find_all("img"):
            for a in ("data-zoom-image","data-large-image","data-src","src"):
                if im.get(a): imgs.append(urljoin(r.url,im.get(a)))
        specs_unicos=[]; seen_specs=set()
        for k,v in specs:
            key=nc(k+"|"+v)
            if key and key not in seen_specs:
                seen_specs.add(key); specs_unicos.append((k,v))
            if len(specs_unicos)>=20: break

        path=urlparse(r.url).path.lower()
        host=dom(r.url)
        es_producto_path=("/producto" in path) or ("/p/" in path)
        es_categoria_path=any(x in path for x in ("/categoria", "/marcas", "/brand", "/search", "/busqueda"))

        return {
            "url":r.url,
            "domain":dom(r.url),
            "title":titulo,
            "desc":desc,
            "desc_larga":" ".join(parrafos[:2]),
            "specs":specs_unicos,
            "bullets":bullets,
            "imgs":imgs,
            "text":limpiar(soup.get_text(" ",strip=True))[:MAX_HTML_TEXT],
            "host":host,
            "es_producto_path":es_producto_path,
            "es_categoria_path":es_categoria_path,
            "es_combo":es_combo_texto(" ".join([titulo,desc," ".join(bullets[:4])]))
        }
    except:return {}

def elegir(p):
    cand=[]
    marca_norm = nc(p["marca"])
    for r in buscar_texto(p):
        pg=analizar(r["url"])
        if SOLO_PACIFIKO and "pacifiko.com" not in (pg.get("domain",r["domain"]) or ""):
            continue
        texto=" ".join([r["title"],r["body"],pg.get("title",""),pg.get("desc",""),pg.get("text","")])
        s=0
        if p["codigo"]: s += 70 if nc(p["codigo"]) in nc(texto) else -50
        if p["marca"] and p["marca"].lower() in texto.lower(): s+=14
        if marca_norm and marca_norm in nc(pg.get("host", "") + " " + pg.get("title", "") + " " + pg.get("desc", "")): s += 20
        if "pacifiko.com" in pg.get("domain",r["domain"]): s+=35
        if pg.get("es_producto_path"): s+=18
        if pg.get("es_categoria_path"): s-=25
        if pg.get("es_combo") or es_combo_texto(texto): s-=60
        if pg.get("specs"): s+=5
        if pg.get("bullets"): s+=5
        cand.append((s,r,pg))
        if not MODO_RAPIDO:
            time.sleep(.1)
    return max(cand,key=lambda x:x[0]) if cand else None

def texto_catalogo(p,pg):
    hechos=[limpiar(x).rstrip(".") for x in pg.get("bullets",[]) if 10<=len(limpiar(x))<=140 and not es_ruido_texto(x)][:4]
    partes=[]
    desc_larga=limpiar(pg.get("desc_larga",""))
    desc=limpiar(pg.get("desc",""))
    if p["marca"] and p["codigo"]: partes.append(f"El modelo {p['codigo']} de {p['marca']} está pensado para un uso práctico y funcional.")
    elif p["codigo"]: partes.append(f"El modelo {p['codigo']} ofrece una propuesta práctica para uso cotidiano.")
    if desc_larga and not es_ruido_texto(desc_larga):
        partes.append(desc_larga)
    elif desc and not es_ruido_texto(desc):
        partes.append(desc)
    if hechos: partes.append("Entre sus características destacan "+ "; ".join(hechos)+".")
    return limpiar(" ".join(partes))

def dhash(img):
    g=img.convert("L").resize((9,8)); px=list(g.getdata()); v=0
    for y in range(8):
        for x in range(8): v=(v<<1)|int(px[y*9+x]>px[y*9+x+1])
    return v
def dist(a,b): return (a^b).bit_count()

def bajar(u,dest,hashes):
    try:
        r=requests.get(u,headers=HEADERS,timeout=20,allow_redirects=True); r.raise_for_status()
        if not r.headers.get("content-type","").lower().startswith("image/") or len(r.content)<5000:return False
        im=Image.open(io.BytesIO(r.content)); im.load()
        if im.width<MIN_W or im.height<MIN_H:return False
        h=dhash(im)
        if any(dist(h,x)<=2 for x in hashes):return False
        hashes.append(h)
        if im.mode!="RGB": im=im.convert("RGB")
        im.save(dest,"JPEG",quality=92)
        return True
    except:return False

def buscar_imgs(p,nombre):
    c,m,pi=p["codigo"],p["marca"],p["pista"]
    qs=[]
    if c:
        qs += [f'"{c}"',f'"{c}" "{m}"',f'{m} {c}',f'{c} product',f'{c} producto',f'{c} foto',f'site:pacifiko.com {c}']
        if pi: qs.append(f'{c} {pi}')
    if nombre: qs += [f'"{nombre}"',f'{nombre} product image']
    out=[]; seen=set()
    with DDGS(timeout=12 if MODO_RAPIDO else 20) as d:
        for q in qs:
            try: rs=d.images(q,region="wt-wt",safesearch="moderate",max_results=MAX_IMAGE_RESULTS_POR_QUERY)
            except: continue
            for r in rs or []:
                u=r.get("image") or r.get("thumbnail") or ""
                if u and u not in seen:
                    seen.add(u); out.append(u)
    return out

def guardar_imgs(p,pg,nombre,carpeta):
    carpeta.mkdir(parents=True,exist_ok=True)
    for f in carpeta.glob("*.jpg"):
        try:f.unlink()
        except:pass
    urls=[]; seen=set()
    for u in pg.get("imgs",[])+buscar_imgs(p,nombre):
        if u and u not in seen:
            seen.add(u); urls.append(u)
    hashes=[]; n=0; fuentes=[]
    for u in urls:
        if n>=MAX_IMG:break
        if bajar(u,carpeta/f"{n+1:02d}.jpg",hashes):
            n+=1; fuentes.append(u); print(f"    imagen {n}/{MAX_IMG}")
    (carpeta/"fuentes_imagenes.txt").write_text("\n".join(f"{i+1:02d}.jpg | {u}" for i,u in enumerate(fuentes)),encoding="utf-8")
    return n, fuentes

def recolectar_urls_imgs(p,pg,nombre):
    urls=[]; seen=set()
    base = list(pg.get("imgs",[]))
    extra = buscar_imgs(p,nombre) if USAR_BUSQUEDA_IMAGENES else []
    for u in base + extra:
        if u and u not in seen:
            seen.add(u); urls.append(u)
        if len(urls)>=MAX_IMG: break
    return urls

def ficha_html(carpeta,fila,specs,bullets):
    imgs="".join(f'<img src="{x.name}">' for x in sorted(carpeta.glob("*.jpg")))
    trs="".join(f"<tr><th>{k}</th><td>{v}</td></tr>" for k,v in specs[:20])
    lis="".join(f"<li>{x}</li>" for x in bullets[:10])
    html=f"""<!doctype html><meta charset="utf-8"><title>{fila['nombre']}</title>
<style>body{{font-family:Arial;background:#f6f6f6}}.w{{max-width:1050px;margin:30px auto;background:#fff;padding:28px;border-radius:12px}}.g{{display:grid;grid-template-columns:1fr 1fr;gap:28px}}.imgs{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}img{{width:100%;aspect-ratio:1/1;object-fit:contain;border:1px solid #ddd}}table{{width:100%;border-collapse:collapse}}th,td{{padding:10px;border-bottom:1px solid #ddd;text-align:left}}</style>
<div class="w"><div class="g"><div class="imgs">{imgs}</div><div><h1>{fila['nombre']}</h1><p><b>{fila['marca']}</b> · Modelo {fila['codigo']}</p><p>{fila['descripcion_catalogo']}</p><ul>{lis}</ul></div></div><h2>Especificaciones</h2><table>{trs}</table><p><small>Fuente principal: {fila['url_fuente']}</small></p></div>"""
    (carpeta/"ficha.html").write_text(html,encoding="utf-8")

def main():
    CARPETA.mkdir(exist_ok=True)
    lineas=[limpiar(x) for x in Path(ENTRADA).read_text(encoding="utf-8-sig").splitlines() if limpiar(x)]
    filas=[]; falt=[]; cache={}
    for i,linea in enumerate(lineas,1):
        p=parsear(linea); key=(p["marca"].lower(),p["codigo"].lower(),p["pista"].lower())
        print(f"\n[{i}/{len(lineas)}] {p['original']}")
        if key in cache:
            f=dict(cache[key]); filas.append(f); continue
        e=elegir(p)
        if not e:
            f={"nombre":p["original"],"codigo":p["codigo"],"categoria":categoria_para(p["marca"]),"imagenes_urls":""}
        else:
            score,r,pg=e
            nombre=pg.get("title") or r["title"]
            fuentes=recolectar_urls_imgs(p,pg,nombre)
            if DESCARGAR_IMAGENES:
                carpeta=CARPETA/seguro(p["codigo"] or p["original"])
                cant, fuentes=guardar_imgs(p,pg,nombre,carpeta)
            else:
                cant=len(fuentes)
            f={"nombre":nombre,"codigo":p["codigo"],"categoria":categoria_para(p["marca"]),"imagenes_urls":"|".join(fuentes[:MAX_IMG])}
            if DESCARGAR_IMAGENES:
                ficha_html(carpeta,f,specs,pg.get("bullets",[]))
            if cant<5:falt.append(f)
            print(f"    Pagina consultada: {pg.get('url') or r['url']}")
        cache[key]=dict(f); filas.append(f)
        campos=["nombre","codigo","categoria","imagenes_urls"]
        with open(SALIDA,"w",newline="",encoding="utf-8-sig") as out:
            w=csv.DictWriter(out,fieldnames=campos); w.writeheader(); w.writerows(filas)
    if falt:
        campos=["nombre","codigo","categoria","imagenes_urls"]
        with open(FALTANTES,"w",newline="",encoding="utf-8-sig") as out:
            w=csv.DictWriter(out,fieldnames=campos); w.writeheader(); w.writerows(falt)
    print("\nListo. Faltantes con menos de 5 imágenes:",len(falt))

if __name__=="__main__": main()
