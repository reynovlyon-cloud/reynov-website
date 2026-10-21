import os, subprocess, sys
W='/private/tmp/claude-501/rey/c'
M='/Users/yourcar/REYNOV-archive-medias/'
OUT='/Users/yourcar/Library/Application Support/Claude/scratch-workspaces/863d9be9-2e06-42d2-9c0d-f2d173da3221/08442528-e9f8-4da4-bde1-e40a537b8d5c/scratch-2026-10-18-f3f3d6/reynov-pubs-v2/'
os.makedirs(OUT,exist_ok=True)
FONT='file:///Users/yourcar/REYNOV/assets/fonts/inter-latin.woff2'
CSS=f"""
@font-face{{font-family:'Inter';font-weight:300 700;src:url('{FONT}') format('woff2');}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#050505;color:#fff;font-family:'Inter',sans-serif;font-weight:400;text-transform:uppercase;overflow:hidden;-webkit-font-smoothing:antialiased}}
.ph{{position:absolute;background-size:cover;background-repeat:no-repeat}}
.abs{{position:absolute}}
.cap{{font-size:17px;letter-spacing:.34em;font-weight:500;color:#9a9a9a}}
.cap b{{color:#fff;font-weight:600}}
.h{{letter-spacing:-.03em;line-height:.96}}
.h .l{{font-weight:300;color:#fff}}
.h .b{{font-weight:700;color:#fff}}
.hr{{height:1px;background:rgba(255,255,255,.22)}}
.proof{{display:flex;align-items:center;font-size:16px;letter-spacing:.28em;color:#d9d9d9;font-weight:500}}
.proof .sep{{width:1px;height:22px;background:rgba(255,255,255,.28);margin:0 26px}}
.stars{{display:inline-flex;gap:6px;margin-right:16px}}
.btn{{background:#fff;color:#050505;font-size:21px;letter-spacing:.3em;font-weight:600;display:flex;align-items:center;justify-content:space-between;padding:0 36px}}
.btn.o{{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.85)}}
"""
STAR='<svg width="17" height="17" viewBox="0 0 24 24"><path fill="#fff" d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.9 5.6 21.5 7 14.3 1.7 9.3l7.2-.9z"/></svg>'
STARS='<span class="stars">'+STAR*5+'</span>'
ARROW='<svg width="46" height="14" viewBox="0 0 46 14"><path d="M0 7h43M37 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
def photo(f,x,y,w,h,pos='50% 50%'):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-image:url(\'file://{M}{f}\');background-position:{pos}"></div>'
def logo(h): return f'<img src="file://{W}/logo_full.png" style="height:{h}px;display:block">'
def page(w,h,body,name):
    p=f'{W}/{name}.html'
    open(p,'w').write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body style="width:{w}px;height:{h}px;position:relative">{body}</body></html>')
    png=f'{OUT}{name}.png'
    subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',f'--window-size={w},{h}',f'--screenshot={png}','--virtual-time-budget=4000','file://'+p],stderr=subprocess.DEVNULL)
    return png
def proof(extra=''): return f'<div class="proof">{STARS}5,0 / 5 · 54 AVIS GOOGLE<span class="sep"></span>GARANTIE 30 JOURS{extra}</div>'

def feed(name,a,b,pa,pb,light,bold,top):
    m=56
    body=f'<div class="abs" style="left:{m}px;top:46px">{logo(70)}</div>'
    body+=f'<div class="abs cap" style="right:{m}px;top:70px;text-align:right">{top}</div>'
    body+=photo(a,m,150,480,720,pa)+photo(b,m+488,150,480,720,pb)
    body+=f'<div class="abs cap" style="left:{m}px;top:890px">AVANT</div><div class="abs cap" style="left:{m+488}px;top:890px"><b>APRÈS</b></div>'
    body+=f'<div class="abs hr" style="left:{m+488}px;top:900px;width:0"></div>'
    body+=f'<div class="abs h" style="left:{m}px;top:948px;font-size:92px"><span class="l">{light}</span><br><span class="b">{bold}</span></div>'
    body+=f'<div class="abs hr" style="left:{m}px;right:{m}px;top:1166px"></div>'
    body+=f'<div class="abs" style="left:{m}px;top:1190px">{proof()}</div>'
    body+=f'<div class="abs btn" style="left:{m}px;right:{m}px;top:1244px;height:70px"><span>DEVIS GRATUIT · RÉPONSE SOUS 24 H</span>{ARROW}</div>'
    return page(1080,1350,body,name)

def story(name,f,pos,light,bold,sub):
    body=photo(f,0,0,1080,1920,pos)
    body+='<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,0) 24%,rgba(0,0,0,0) 38%,rgba(5,5,5,.88) 66%,#050505 90%)"></div>'
    body+=f'<div class="abs" style="left:0;width:1080px;top:290px;display:flex;justify-content:center">{logo(128)}</div>'
    body+=f'<div class="abs h" style="left:64px;top:1170px;font-size:104px"><span class="l">{light}</span><br><span class="b">{bold}</span></div>'
    body+=f'<div class="abs hr" style="left:64px;right:64px;top:1432px"></div>'
    body+=f'<div class="abs cap" style="left:64px;top:1456px;font-size:19px;color:#cfcfcf">{sub}</div>'
    body+=f'<div class="abs" style="left:64px;top:1500px">{proof()}</div>'
    body+=f'<div class="abs btn o" style="left:64px;right:64px;top:1560px;height:84px;font-size:23px"><span>DEVIS GRATUIT</span>{ARROW}</div>'
    return page(1080,1920,body,name)

def slide_hook(name,f,pos,light,bold):
    body=photo(f,0,0,1080,1080,pos)
    body+='<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 26%,rgba(5,5,5,.5) 56%,#050505 96%)"></div>'
    body+=f'<div class="abs" style="left:56px;top:50px">{logo(76)}</div>'
    body+=f'<div class="abs h" style="left:56px;top:700px;font-size:104px"><span class="l">{light}</span><br><span class="b">{bold}</span></div>'
    body+=f'<div class="abs hr" style="left:56px;right:56px;top:972px"></div>'
    body+=f'<div class="abs cap" style="left:56px;top:996px;color:#cfcfcf">RÉNOVATION DE JANTES · À DOMICILE OU EN ATELIER</div><div class="abs cap" style="right:56px;top:996px">GLISSEZ&nbsp;&nbsp;→</div>'
    return page(1080,1080,body,name)

def slide_ba(name,a,b,pa,pb,tag,light,bold):
    m=56
    body=photo(a,m,56,480,620,pa)+photo(b,m+488,56,480,620,pb)
    body+=f'<div class="abs cap" style="left:{m}px;top:696px">AVANT</div><div class="abs cap" style="left:{m+488}px;top:696px"><b>APRÈS</b></div><div class="abs cap" style="right:{m}px;top:696px;text-align:right">{tag}</div>'
    body+=f'<div class="abs h" style="left:{m}px;top:760px;font-size:80px"><span class="l">{light}</span><br><span class="b">{bold}</span></div>'
    body+=f'<div class="abs hr" style="left:{m}px;right:{m}px;top:978px"></div>'
    body+=f'<div class="abs" style="left:{m}px;top:1006px">{STARS}<span class="cap" style="color:#d9d9d9;letter-spacing:.28em">5,0 / 5 · 54 AVIS GOOGLE</span></div><div class="abs" style="right:{m}px;top:996px">{logo(44)}</div>'
    return page(1080,1080,body,name)

def slide_cta(name):
    body=f'<div class="abs" style="left:0;width:1080px;top:120px;display:flex;justify-content:center">{logo(230)}</div>'
    body+=f'<div class="abs hr" style="left:56px;right:56px;top:470px"></div>'
    body+=f'<div class="abs h" style="left:0;width:1080px;top:520px;font-size:88px;text-align:center"><span class="l">DEVIS GRATUIT</span><br><span class="b">SOUS 24 H.</span></div>'
    body+=f'<div class="abs cap" style="left:0;width:1080px;top:740px;text-align:center;color:#cfcfcf">RÉNOVATION DE JANTES · À DOMICILE OU EN ATELIER</div>'
    body+=f'<div class="abs" style="left:0;width:1080px;top:800px;display:flex;justify-content:center">{proof()}</div>'
    body+=f'<div class="abs btn" style="left:56px;right:56px;top:880px;height:88px"><span>OBTENIR MON DEVIS</span>{ARROW}</div>'
    body+=f'<div class="abs cap" style="left:0;width:1080px;top:1000px;text-align:center;letter-spacing:.3em">06 61 45 35 27 · LYON &amp; RHÔNE-ALPES</div>'
    return page(1080,1080,body,name)

only=sys.argv[1:]
def run(n,fn,*a):
    if not only or n in only: print(fn(n,*a))
run('feed_BMW',feed,'bmw-jante-avant.jpg','bmw-jante-apres.jpg','50% 55%','50% 50%','RÉNOVATION','DE JANTES.','BMW · DE L’ABÎMÉ AU COMME NEUF')
run('feed_KIA',feed,'kia-avant.jpg','kia-apres.jpg','50% 50%','50% 50%','RÉNOVATION','DE JANTES.','KIA · DÉCAPAGE, PEINTURE, VERNIS')
run('feed_MERCEDES',feed,'mercedes-jante-avant.jpg','mercedes-jante-apres.jpg','50% 50%','50% 50%','RÉNOVATION','DE JANTES.','MERCEDES · IMPACT DE TROTTOIR')
run('story_MOBILE',story,'service-mobile-1.jpg','50% 50%','RÉNOVATION','À DOMICILE.','L’ATELIER SE DÉPLACE · LYON &amp; RHÔNE-ALPES')
run('story_PRO',story,'defender-pendant.jpg','50% 40%','RÉNOVATION','DE JANTES.','SAVOIR-FAIRE D’ATELIER · LYON &amp; RHÔNE-ALPES')
run('carousel_1',slide_hook,'bmw-jante-apres.jpg','50% 50%','RÉNOVATION','DE JANTES.')
run('carousel_2',slide_ba,'bmw-jante-avant.jpg','bmw-jante-apres.jpg','50% 55%','50% 50%','BMW','RÉNOVATION','COMPLÈTE.')
run('carousel_3',slide_ba,'kia-avant.jpg','kia-apres.jpg','50% 50%','50% 50%','KIA','RÉNOVATION','COMME NEUVE.')
run('carousel_4',slide_ba,'mercedes-jante-avant.jpg','mercedes-jante-apres.jpg','50% 50%','50% 50%','MERCEDES','RÉNOVATION','IMPACT EFFACÉ.')
run('carousel_5',slide_cta)
