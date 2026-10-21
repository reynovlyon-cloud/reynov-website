import os, subprocess, sys
from PIL import Image
W='/private/tmp/claude-501/rey/b'
M='/Users/yourcar/REYNOV-archive-medias/'
OUT='/Users/yourcar/Library/Application Support/Claude/scratch-workspaces/863d9be9-2e06-42d2-9c0d-f2d173da3221/08442528-e9f8-4da4-bde1-e40a537b8d5c/scratch-2026-10-18-f3f3d6/reynov-pubs/'
os.makedirs(OUT,exist_ok=True)
# logos : originaux, seulement rognés de leurs marges transparentes
Image.open('/Users/yourcar/Desktop/reynov_logo_transparent_clean_2x.png').crop((718,177,1384,1028)).save(W+'/logo_full.png')
Image.open('/Users/yourcar/Downloads/reynov_logo_perfect.png').crop((447,447,3553,3553)).save(W+'/logo_sym.png')
FONT='file:///Users/yourcar/REYNOV/assets/fonts/inter-latin.woff2'
CSS=f"""
@font-face{{font-family:'Inter';font-weight:300 700;src:url('{FONT}') format('woff2');}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#0a0a0a;color:#fff;font-family:'Inter',sans-serif;font-weight:700;text-transform:uppercase;overflow:hidden;-webkit-font-smoothing:antialiased}}
.ph{{position:absolute;background-size:cover;background-repeat:no-repeat}}
.pill{{position:absolute;font-size:22px;letter-spacing:.18em;padding:12px 20px;font-weight:700}}
.pill.a{{background:rgba(0,0,0,.72);color:#fff;border:1.5px solid rgba(255,255,255,.55)}}
.pill.b{{background:#fff;color:#000}}
.h{{font-size:84px;line-height:.98;letter-spacing:-.025em}}
.h i{{font-style:normal;color:#8f8f8f}}
.sub{{font-weight:500;letter-spacing:.14em;font-size:22px;color:#c4c4c4}}
.proof{{display:flex;align-items:center;font-size:19px;letter-spacing:.12em;color:#e6e6e6;font-weight:600}}
.proof .sep{{width:1.5px;height:30px;background:#3a3a3a;margin:0 26px}}
.stars{{display:inline-flex;gap:5px;margin-right:14px}}
.btn{{background:#fff;color:#000;font-size:28px;letter-spacing:.08em;display:flex;align-items:center;justify-content:center;font-weight:700}}
.tel{{font-weight:600;letter-spacing:.1em}}
"""
STAR='<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#fff" d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.9 5.6 21.5 7 14.3 1.7 9.3l7.2-.9z"/></svg>'
STARS='<span class="stars">'+STAR*5+'</span>'
def photo(f,x,y,w,h,pos='50% 50%',extra=''):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-image:url(\'file://{M}{f}\');background-position:{pos};{extra}"></div>'
def page(w,h,body,name):
    html=f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body style="width:{w}px;height:{h}px;position:relative">{body}</body></html>'
    p=f'{W}/{name}.html'; open(p,'w').write(html)
    png=f'{OUT}{name}.png'
    subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',f'--window-size={w},{h}',f'--screenshot={png}','--virtual-time-budget=4000','file://'+p],stderr=subprocess.DEVNULL)
    return png
LOGO_F='<img src="file://'+W+'/logo_full.png" style="height:%dpx">'
LOGO_S='<img src="file://'+W+'/logo_sym.png" style="height:%dpx">'

def feed(name,a,b,pa,pb,l1,l2,sub,PH=800):
    body=photo(a,0,0,538,PH,pa)+photo(b,542,0,538,PH,pb)
    body+=f'<div style="position:absolute;left:0;top:{PH-260}px;width:1080px;height:262px;background:linear-gradient(180deg,rgba(10,10,10,0) 0%,#0a0a0a 96%)"></div>'
    body+='<div class="pill a" style="left:28px;top:28px">AVANT</div><div class="pill b" style="left:570px;top:28px">APRÈS</div>'
    body+=f'<div style="position:absolute;left:64px;top:{PH-70}px;width:952px"><div class="h">{l1}<br><i>{l2}</i></div><div class="sub" style="margin-top:22px">{sub}</div></div>'
    body+=f'<div class="proof" style="position:absolute;left:64px;top:{PH+178}px">{STARS}5,0 · 54 AVIS GOOGLE<span class="sep"></span>GARANTIE 30 JOURS<span class="sep"></span>LYON</div>'
    body+=f'<div class="btn" style="position:absolute;left:64px;top:1180px;width:700px;height:96px">DEVIS GRATUIT SOUS 24H&nbsp;&nbsp;→</div>'
    body+=f'<div style="position:absolute;right:64px;top:1180px;height:96px;display:flex;align-items:center">{LOGO_F%96}</div>'
    return page(1080,1350,body,name)

def story(name,f,pos,l1,l2,sub,top=1180):
    body=photo(f,0,0,1080,1920,pos)
    body+='<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,0) 40%,rgba(0,0,0,.82) 66%,#0a0a0a 92%)"></div>'
    body+=f'<div style="position:absolute;left:0;width:1080px;top:290px;display:flex;justify-content:center">{LOGO_F%120}</div>'
    body+=f'<div style="position:absolute;left:64px;top:{top}px;width:952px"><div class="h" style="font-size:88px">{l1}<br><i>{l2}</i></div><div class="sub" style="margin-top:26px;font-size:25px">{sub}</div></div>'
    body+=f'<div class="proof" style="position:absolute;left:64px;top:{top+330}px">{STARS}5,0 · 54 AVIS GOOGLE<span class="sep"></span>GARANTIE 30 JOURS</div>'
    body+=f'<div class="btn" style="position:absolute;left:64px;top:{top+410}px;width:952px;height:104px;font-size:30px">DEVIS GRATUIT SOUS 24H&nbsp;&nbsp;→</div>'
    return page(1080,1920,body,name)

def slide_ba(name,a,b,pa,pb,tag,l1):
    body=photo(a,0,0,538,720,pa)+photo(b,542,0,538,720,pb)
    body+='<div class="pill a" style="left:28px;top:28px">AVANT</div><div class="pill b" style="left:570px;top:28px">APRÈS</div>'
    body+=f'<div style="position:absolute;left:64px;top:770px;width:952px"><div class="sub" style="color:#8f8f8f">{tag}</div><div class="h" style="font-size:72px;margin-top:18px">{l1}</div></div>'
    body+=f'<div style="position:absolute;left:64px;right:64px;bottom:44px;display:flex;justify-content:space-between;align-items:center"><div class="proof" style="font-size:17px">{STARS}5,0 · 54 AVIS GOOGLE</div>{LOGO_F%64}</div>'
    return page(1080,1080,body,name)

def slide_hook(name,f,pos,l1,l2):
    body=photo(f,0,0,1080,1080,pos)
    body+='<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 28%,rgba(0,0,0,.55) 58%,#0a0a0a 100%)"></div>'
    body+=f'<div style="position:absolute;left:64px;top:60px">{LOGO_F%84}</div>'
    body+=f'<div style="position:absolute;left:64px;bottom:150px;width:952px"><div class="h" style="font-size:92px">{l1}<br><i style="color:#bdbdbd">{l2}</i></div></div>'
    body+='<div class="sub" style="position:absolute;left:64px;bottom:64px;font-size:22px">GLISSEZ POUR VOIR LES RÉSULTATS&nbsp;&nbsp;→</div>'
    return page(1080,1080,body,name)

def slide_cta(name):
    body=f'<div style="position:absolute;left:0;width:1080px;top:150px;display:flex;justify-content:center">{LOGO_F%230}</div>'
    body+='<div style="position:absolute;left:64px;width:952px;top:470px;text-align:center"><div class="h" style="font-size:82px">VOS JANTES.<br><i>COMME NEUVES.</i></div><div class="sub" style="margin-top:26px">RÉNOVATION DE JANTES · À DOMICILE OU EN ATELIER</div></div>'
    body+=f'<div class="proof" style="position:absolute;left:0;width:1080px;justify-content:center;top:800px">{STARS}5,0 · 54 AVIS GOOGLE<span class="sep"></span>GARANTIE 30 JOURS</div>'
    body+='<div class="btn" style="position:absolute;left:64px;top:880px;width:952px;height:104px;font-size:30px">DEVIS GRATUIT SOUS 24H&nbsp;&nbsp;→</div>'
    body+='<div class="tel" style="position:absolute;left:0;width:1080px;text-align:center;top:1010px;font-size:22px;color:#c4c4c4">06 61 45 35 27 · LYON &amp; RHÔNE-ALPES</div>'
    return page(1080,1080,body,name)

only=sys.argv[1:] 
def run(n,fn,*a,**k):
    if not only or n in only: print(fn(n,*a,**k))
run('feed_BMW',feed,'bmw-jante-avant.jpg','bmw-jante-apres.jpg','50% 55%','50% 50%','ABÎMÉE.','IMPECCABLE.','RÉNOVATION DE JANTES · BMW')
run('feed_KIA',feed,'kia-avant.jpg','kia-apres.jpg','50% 50%','50% 50%','VOS JANTES.','COMME NEUVES.','RÉNOVATION DE JANTES · KIA')
run('feed_MERCEDES',feed,'mercedes-jante-avant.jpg','mercedes-jante-apres.jpg','50% 50%','50% 50%','FROTTÉE ?','EFFACÉE.','FROTTEMENT DE TROTTOIR · MERCEDES')
run('story_MOBILE',story,'service-mobile-1.jpg','50% 50%','ON VIENT','À VOUS.','ATELIER MOBILE · LYON &amp; RHÔNE-ALPES')
run('story_PRO',story,'defender-pendant.jpg','50% 40%','DES MAINS DE PRO.','RÉSULTAT GARANTI.','RÉNOVATION DE JANTES · LYON')
run('carousel_1',slide_hook,'bmw-jante-apres.jpg','50% 50%','VOS JANTES','MÉRITENT MIEUX.')
run('carousel_2',slide_ba,'bmw-jante-avant.jpg','bmw-jante-apres.jpg','50% 55%','50% 50%','BMW · RÉNOVATION COMPLÈTE','D’ABÎMÉE À IMPECCABLE.')
run('carousel_3',slide_ba,'kia-avant.jpg','kia-apres.jpg','50% 50%','50% 50%','KIA · RÉNOVATION COMPLÈTE','L’ÉCLAT DU NEUF.')
run('carousel_4',slide_ba,'mercedes-jante-avant.jpg','mercedes-jante-apres.jpg','50% 50%','50% 50%','MERCEDES · FROTTEMENT DE TROTTOIR','EFFACÉ.')
run('carousel_5',slide_cta)
