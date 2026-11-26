"""Trae a la biblioteca del cotizador las fotos nuevas del panel de producción (taller-gary).

Uso:  python3 herramientas/sincronizar_imagenes.py URL_PANEL [--probar] [--marcar-todo]
  URL_PANEL      URL de lectura (Apps Script) del panel de producción.
  --probar       solo informa lo que haría, sin escribir nada.
  --marcar-todo  marca todas las filas actuales del panel como ya revisadas (primera vez).

Reglas (ver CLAUDE.md, sección Imágenes):
- Cada fila del panel se revisa una sola vez (Config 'panelVistos' guarda su uid).
- Si la foto ya está en la biblioteca (mismo contenido, o visualmente igual con nombre compatible),
  no se sube de nuevo: se suma el uso, el nombre del producto, el cliente y la OT a esa entrada.
- Si es nueva, se sube la imagen (máx. 900 px) y su miniatura (260 px) y se agrega a la biblioteca.
"""
import base64, hashlib, io, json, re, ssl, sys, time, unicodedata, urllib.request
from PIL import Image

NUBE = re.search(r"NUBE_URL = window.__NUBE_URL__ \|\|\s*'([^']+)'", open(__file__.rsplit('/herramientas', 1)[0] + '/app.js').read()).group(1)
CA = '/root/.ccr/ca-bundle.crt'
try:
    CTX = ssl.create_default_context(cafile=CA)
except Exception:
    CTX = ssl.create_default_context()


def http(url, cuerpo=None, intentos=4):
    for k in range(intentos):
        try:
            data = None if cuerpo is None else json.dumps(cuerpo, ensure_ascii=False).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'text/plain;charset=utf-8'})
            with urllib.request.urlopen(req, context=CTX, timeout=200) as r:
                j = json.loads(r.read().decode('utf-8'))
            if cuerpo is None or j.get('ok'):
                return j
            if 'ocupado' not in str(j.get('error', '')).lower():
                raise RuntimeError(j.get('error'))
        except Exception:
            if k == intentos - 1:
                raise
        time.sleep(4 * (k + 1))


api = lambda accion, **kw: http(NUBE, {'accion': accion, **kw})


def fix(s):  # textos con tildes mal codificadas ("MÃ¡stil")
    if isinstance(s, str) and ('Ã' in s or 'Â' in s):
        try:
            return s.encode('latin-1').decode('utf-8')
        except Exception:
            pass
    return (s or '').strip() if isinstance(s, str) else str(s or '').strip()


def abrir(durl):
    im = Image.open(io.BytesIO(base64.b64decode(durl.split(',', 1)[1])))
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); f = Image.new('RGB', im.size, 'white'); f.paste(im, mask=im.split()[-1]); return f
    return im.convert('RGB')


def jpeg(im, max_px, q):
    k = min(1, max_px / max(im.size))
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


# ---- firma visual: mismo cálculo que firmaImagen() en app.js ----
def firma(durl):
    im = abrir(durl); w, h = im.size; px = im.load(); b = px[0, 0]
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if abs(p[0] - b[0]) + abs(p[1] - b[1]) + abs(p[2] - b[2]) > 60:
                x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
    if x1 < 0 or (x1 - x0 + 1) * (y1 - y0 + 1) < w * h * 0.2:
        x0, y0, x1, y1 = 0, 0, w, h
    else:
        x1 += 1; y1 += 1

    def grilla(gc, gf):
        out = []
        for r in range(gf):
            for c in range(gc):
                a, bb = x0 + (x1 - x0) * c // gc, x0 + (x1 - x0) * (c + 1) // gc
                t, u = y0 + (y1 - y0) * r // gf, y0 + (y1 - y0) * (r + 1) // gf
                s = [0, 0, 0]; n = 0
                for yy in range(t, max(u, t + 1)):
                    for xx in range(a, max(bb, a + 1)):
                        p = px[xx, yy]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; n += 1
                out.append([v / n for v in s])
        return out
    gris = lambda p: .299 * p[0] + .587 * p[1] + .114 * p[2]
    d = [gris(p) for p in grilla(9, 8)]
    bits = ''.join('1' if d[r * 9 + c] < d[r * 9 + c + 1] else '0' for r in range(8) for c in range(8))
    return {'h': '%016x' % int(bits, 2), 'col': [v for p in grilla(8, 8) for v in p], 'fino': [gris(p) for p in grilla(48, 48)]}


SIN = {'pab': 'pabellon', 'nac': 'nacional', 'gall': 'gallardete', 'ecritorio': 'escritorio', 'escr': 'escritorio', 'inst': 'institucional', 'bom': 'bomberos'}
GEN = set(('municipalidad ilustre corporacion municipal servicio region regional comuna chile sociedad limitada ltda empresa gobierno '
           'ministerio departamento direccion provincial nacional publica publico educacion salud deporte deportes colegio liceo escuela '
           'universidad compania club fundacion asociacion centro general bandera banderas institucional gallardete gallardetes insignia '
           'estandarte escritorio doble raso bistrech oxford flecos cordon dorado driza mastil madera especial modelo').split())
norm = lambda s: unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
claves = lambda ns: {w for n in ns for w in (SIN.get(x, x) for x in re.split(r'[^a-z0-9]+', norm(n))) if len(w) >= 4 and w not in GEN}
ham = lambda a, b: bin(int(a, 16) ^ int(b, 16)).count('1')


def misma(sa, sb, na, nb):
    dh = ham(sa['h'], sb['h'])
    if dh > 18 or sum(abs(x - y) for x, y in zip(sa['col'], sb['col'])) / len(sa['col']) > 10.5:
        return False
    if dh <= 14 and sum(abs(x - y) > 60 for x, y in zip(sa['fino'], sb['fino'])) / len(sa['fino']) * 100 <= 3:
        return True
    ka, kb = claves(na), claves(nb)
    return any(x.startswith(y) or y.startswith(x) for x in ka for y in kb)


def unir(lst, v, maximo):
    if v and not any(norm(x) == norm(v) for x in lst):
        lst.append(v)
    return lst[:maximo]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    probar, marcar = '--probar' in sys.argv, '--marcar-todo' in sys.argv
    panel = http(args[0])
    filas = [r for r in panel.get('rows', []) if r.get('uid')]
    cfg = api('cargar')['config']
    vistos = set(cfg.get('panelVistos') or [])
    bib = [e for i in range(int(cfg.get('bibPartes') or 0)) for e in (cfg.get('bib%d' % i) or [])]
    if isinstance(cfg.get('biblioteca'), list):
        ids = {e['i'] for e in bib}; bib += [e for e in cfg['biblioteca'] if e['i'] not in ids]
    print(f'Panel: {len(filas)} filas · ya revisadas: {len(vistos)} · biblioteca: {len(bib)} imágenes')
    if marcar:
        if not probar:
            api('guardarConfig', config={'panelVistos': sorted(r['uid'] for r in filas)})
        print('Marcadas como revisadas:', len(filas)); return
    nuevas_filas = [r for r in filas if r['uid'] not in vistos]
    por_id = {}
    for e in bib:
        for x in [e['i']] + (e.get('a') or []):
            por_id[x] = e
    sig_cache = {}

    def sig_de(e):
        if e['i'] not in sig_cache:
            tid = e.get('t') or e['i']
            img = api('leerImagenes', ids=[tid]).get('imagenes', {}).get(tid)
            sig_cache[e['i']] = firma(img) if img else None
        return sig_cache[e['i']]

    subidas, sumadas, cambio = 0, 0, False
    for r in nuevas_filas:
        foto = r.get('foto')
        vistos.add(r['uid'])
        if not (isinstance(foto, str) and foto.startswith('data:image')):
            continue
        prod, cli, ot = fix(r.get('producto'))[:60], fix(r.get('cliente'))[:60], str(r.get('ot') or '').strip()
        fecha = str(r.get('fCom') or '')[:10] or time.strftime('%Y-%m-%d')
        iid = 'ot' + hashlib.sha1(foto.encode()).hexdigest()[:14]
        e = por_id.get(iid)
        if not e:
            im = abrir(foto); thumb = jpeg(im, 260, 75); s = firma(thumb)
            for c in bib:
                if c.get('h') and ham(c['h'], s['h']) <= 18:
                    sc = sig_de(c)
                    if sc and misma(s, sc, [prod], c.get('n') or []):
                        e = c; break
            if not e:
                full = foto if len(foto) <= 120000 else jpeg(im, 900, 80)
                e = {'i': iid, 't': 'th' + iid, 'n': [], 'c': [], 'o': ot, 'u': 0, 'f': fecha, 's': 'ot', 'h': s['h']}
                if not probar:
                    api('guardarImagen', id='th' + iid, data=thumb)
                    api('guardarImagen', id=iid, data=full)
                bib.append(e); por_id[iid] = e; subidas += 1
                print(f'  + nueva: {prod or "(sin nombre)"} · {cli} · OT {ot}')
            else:
                sumadas += 1
                print(f'  = ya estaba: {prod or "(sin nombre)"} → «{(e.get("n") or ["?"])[0]}»')
            if iid != e['i']:
                e['a'] = sorted(set((e.get('a') or []) + [iid])); por_id[iid] = e
        else:
            sumadas += 1
        e['n'] = unir(e.get('n') or [], prod, 8); e['c'] = unir(e.get('c') or [], cli, 10)
        e['u'] = (+e.get('u', 0) or 0) + 1
        if ot: e['o'] = ot
        if fecha > str(e.get('f') or ''): e['f'] = fecha
        cambio = True

    if not probar and (cambio or nuevas_filas):
        nuevo = {'panelVistos': sorted(vistos)}
        if cambio:
            partes, act, largo = [], [], 2
            for e in bib:
                l = len(json.dumps(e, ensure_ascii=False)) + 1
                if largo + l > 35000 and act:
                    partes.append(act); act, largo = [], 2
                act.append(e); largo += l
            if act: partes.append(act)
            viejas = int(cfg.get('bibPartes') or 0)
            nuevo.update({'bibPartes': len(partes), 'biblioteca': None})
            for i in range(max(len(partes), viejas)):
                nuevo['bib%d' % i] = partes[i] if i < len(partes) else None
        api('guardarConfig', config=nuevo)
    print(f'LISTO{" (prueba, sin escribir)" if probar else ""}: {len(nuevas_filas)} filas nuevas del panel · '
          f'{subidas} imágenes nuevas subidas · {sumadas} ya estaban (se sumó el uso) · biblioteca: {len(bib)} imágenes')


if __name__ == '__main__':
    main()
