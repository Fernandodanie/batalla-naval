from playwright.sync_api import sync_playwright
from pathlib import Path
import re
import shutil

P=Path(__file__).resolve().parents[2] / 'frontend' / 'public'
sources={x.name:x.read_text() for x in (P/'js').glob('*.js')}
html=(P/'index.html').read_text()
html=re.sub(r'<script.*?</script>','',html,flags=re.S)
html=re.sub(r'<link[^>]+(?:href="(?:css/|fonts/|img/|manifest\.))[^>]*>','',html)
html=html.replace('</head>',f'<style>{(P/"css/style.css").read_text()}</style></head>')

BOOT='''async () => {
  const {GameView} = await import(window.moduleUrls['game-view.js']);
  document.getElementById('screen-welcome').hidden = true;
  document.getElementById('screen-game').hidden = false;
  document.body.classList.add('hub', 'in-game');
  window.gv = new GameView({ send: () => true, onLeave: () => {} });
  window.makeState = (round) => ({
    status:'placing', room:'CASE', round, biome:'land',you:'A',spectators:0,timeLeft:60000,
    players:{A:{name:'Jugador',ready:false,online:true,avatar:'J'}, B:{name:'Rival',ready:false,online:true,avatar:'R'}},
    wins:{A:0,B:0},
    game:{status:'placing', size:8, turn:'A', ready:{A:false,B:false},
      boards:{ A:{fleet:[{id:'3-0',length:3,name:'Infantería'},{id:'2-0',length:2,name:'Caballería'}]}, B:{fleet:[]}},
      stats:{A:{shots:0,hits:0},B:{shots:0,hits:0}}
    }
  });
  gv.render(makeState(1));
  return {cells:document.querySelectorAll('#board-place .cell').length, chips:document.querySelectorAll('.ship-chip').length};
}'''

REGISTER='''(sources) => {
 const urls={};
 const build=(file) => {
  if (urls[file]) return urls[file];
  if (!(file in sources)) throw new Error('missing '+file);
  const code=sources[file].replace(/(from\\s+['"]|import\\s*\\(\\s*['"])(\\.\\/[^'"\\)]+)(['"])/g,(match,prefix,relative,suffix)=> {
    return prefix+build(relative.slice(2))+suffix;
  });
  return (urls[file]=URL.createObjectURL(new Blob([code], {type:'text/javascript'})));
 };
 build('game-view.js');
 window.moduleUrls=urls;
 return Object.keys(urls);
}'''

with sync_playwright() as p:
    try:
        browser=p.chromium.launch(headless=True)
    except Exception:
        executable = shutil.which('chromium') or shutil.which('google-chrome') or shutil.which('chrome')
        if not executable:
            raise RuntimeError('Instala Chromium con: python -m playwright install chromium')
        browser=p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
    for mobile in [False,True]:
        context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 900},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile)
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda e:errors.append(str(e)))
        page.set_content(html)
        files=page.evaluate(REGISTER,sources)
        print('Loaded modules',len(files),'mobile',mobile)
        print('Fixture',page.evaluate(BOOT))
        if not mobile:
            chip=page.locator('.ship-chip').first
            cell=page.locator('#board-place .cell[data-r="1"][data-c="1"]')
            a=chip.bounding_box();b=cell.bounding_box()
            print('Bounding boxes',a,b)
            page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2)
            page.mouse.down();page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2,steps=12);page.mouse.up()
            d=page.evaluate('Object.fromEntries(gv.draft.placed)')
            print('Mouse dragged from list:',d)
            assert d['3-0']['row']==1 and d['3-0']['col']==1,d
            start=page.locator('#board-place .cell[data-r="1"][data-c="1"]').bounding_box()
            dest=page.locator('#board-place .cell[data-r="3"][data-c="2"]').bounding_box()
            page.mouse.move(start['x']+start['width']/2,start['y']+start['height']/2)
            page.mouse.down();page.mouse.move(dest['x']+dest['width']/2,dest['y']+dest['height']/2,steps=12);page.mouse.up()
            d=page.evaluate('Object.fromEntries(gv.draft.placed)')
            print('Mouse move already placed:',d)
            assert d['3-0']['row']==3 and d['3-0']['col']==2,d
            for rnd in [2,3,4]:
                page.evaluate(f'gv.render(makeState({rnd}))')
                page.locator('#board-place .cell[data-r="0"][data-c="0"]').click()
                d=page.evaluate('({ placed: gv.draft.toShips(), selected: gv.draft.selected })')
                print('Round',rnd,d)
                assert len(d['placed'])==1 and d['selected']=='2-0',d
        else:
            page.locator('#board-place .cell[data-r="0"][data-c="0"]').tap()
            d=page.evaluate('({ placed: gv.draft.toShips(), selected: gv.draft.selected })')
            print('Touch tap:',d)
            assert len(d['placed'])==1 and d['selected']=='2-0',d
            st=page.locator('#board-place .cell[data-r="0"][data-c="0"]').bounding_box()
            dest=page.locator('#board-place .cell[data-r="3"][data-c="2"]').bounding_box()
            x1=int(st['x']+st['width']/2);y1=int(st['y']+st['height']/2)
            x2=int(dest['x']+dest['width']/2);y2=int(dest['y']+dest['height']/2)
            cdp=context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x1,'y':y1,'id':1}]})
            for i in range(1,9):
                cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':int(x1+(x2-x1)*i/8),'y':int(y1+(y2-y1)*i/8),'id':1}]})
                page.wait_for_timeout(25)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            page.wait_for_timeout(200)
            d=page.evaluate('({ placed: gv.draft.toShips(), selected: gv.draft.selected })')
            print('Touch move:',d)
            assert d['placed'][0]['row']==3 and d['placed'][0]['col']==2,d
        assert not errors,errors
        page.evaluate('gv.destroy()')
        context.close()
    browser.close()
print('ALL BROWSER TESTS PASSED')
