#!/usr/bin/env python3
"""Developer-only viewer checks. Requires Python Playwright + Chromium, not needed by users.

Default: real browser navigation to a running CodeAtlas --url.
--embedded: render identical local HTML/CSS/JS in about:blank and forward fetch to
our local HTTP server through a Playwright binding. This mode is for restricted
browser test environments; it is NOT native-host or browser-network verification.
"""
import argparse
import base64
import json
import pathlib
import re
import time
import subprocess
import tempfile
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--out', default='test-results/browser')
    parser.add_argument('--embedded', action='store_true')
    parser.add_argument('--project', help='Optional isolated demo project to test live publications')
    parser.add_argument('--chromium', default=None)
    args = parser.parse_args()
    out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=True)
    origin = args.url.split('/?')[0].rstrip('/')
    token = args.url.split('#token=')[-1]
    checks = []
    def check(name, condition):
        if not condition: raise AssertionError(name)
        checks.append(name)
    def bridge(route, opts):
        if not route.startswith('/api/') and not route.startswith('/assets/'):
            raise ValueError('Only local CodeAtlas API/assets may be bridged')
        request = urllib.request.Request(origin + route, data=(opts.get('body') or '').encode() if opts.get('body') else None, headers=opts.get('headers', {}), method=opts.get('method', 'GET'))
        try:
            with urllib.request.urlopen(request, timeout=5) as r:
                return {'status': r.status, 'headers': dict(r.headers), 'body': r.read().decode()}
        except urllib.error.HTTPError as e:
            return {'status': e.code, 'headers': dict(e.headers), 'body': e.read().decode()}
    baseline=json.loads(bridge('/api/graph', {'headers':{'Authorization':'Bearer '+token}})['body'])
    if not baseline['project'].get('demo'):raise ValueError('Browser tests require an isolated CodeAtlas demo, not a real project')
    bridge('/api/selection', {'method':'POST','headers':{'Authorization':'Bearer '+token,'Content-Type':'application/json'},'body':json.dumps({'session':'main','nodeIds':['web.products'],'graphRevision':baseline['revision'],'viewId':'purchase','intent':'question'})})
    with sync_playwright() as p:
        launch = {'headless': True}
        if args.chromium: launch['executable_path'] = args.chromium
        browser = p.chromium.launch(**launch)
        page = browser.new_page(viewport={'width': 1536, 'height': 1024}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: (errors.append(str(e)),print('PAGE ERROR:',e)))
        if args.embedded:
            html = (ROOT/'web/index.html').read_text()
            html = re.sub(r'<link[^>]*>', '', html)
            html = re.sub(r'<script.*?</script>', '', html, flags=re.S)
            html = html.replace('</head>', '<style>'+(ROOT/'web/style.css').read_text()+'</style></head>')
            page.set_content(html)
            page.expose_function('atlasFetch', bridge)
            page.evaluate('''(token) => {
              const makeStore=(init={})=>({getItem:k=>init[k]??null,setItem:(k,v)=>init[k]=String(v),removeItem:k=>delete init[k]});
              Object.defineProperty(window,'sessionStorage',{value:makeStore({'codeatlas-token':token})});
              Object.defineProperty(window,'localStorage',{value:makeStore()});
              window.fetch=async(route,opts={})=>{const r=await window.atlasFetch(route,opts);return new Response(r.status===304?null:r.body,{status:r.status,headers:r.headers});};
            }''', token)
            icons = (ROOT/'web/icons.js').read_text().replace('export const icon=', 'const icon=')
            script = (ROOT/'web/app.js').read_text().replace("import {icon} from './icons.js';", '')
            logo = 'data:image/svg+xml;base64,'+base64.b64encode((ROOT/'web/logo.svg').read_bytes()).decode()
            script = script.replace('src="/logo.svg"', f'src="{logo}"')
            page.add_script_tag(content=icons+'\n'+script)
        else:
            page.goto(args.url, wait_until='networkidle')
        page.wait_for_selector('[data-node="web.products"]')
        page.wait_for_timeout(250)
        check('overview has nine focused nodes', page.locator('[data-node]').count() == 9)
        check('Korean user flow heading', '상품 탐색과 구매' in page.locator('h1').inner_text())
        check('demo is clearly labeled', page.locator('.bar-note.demo').count() == 1)
        page.screenshot(path=str(out/'01-overview.png'))
        page.locator('[data-node="web.detail"]').click()
        page.wait_for_timeout(100)
        check('node selection populates detail panel', page.locator('.detail-title').inner_text() == '상품 상세')
        page.locator('[data-node="web.cart"]').click(modifiers=['Shift'])
        page.wait_for_timeout(150)
        check('shift click multi-selection', '2개 항목' in page.locator('.detail-title').inner_text())
        page.locator('[data-node="web.products"]').click()
        page.locator('.detail-tabs [data-tab="connections"]').click()
        check('connection panel includes shared API', page.locator('[data-related="api.products"]').count() == 1)
        page.locator('[data-related="api.products"]').click()
        check('connected node can be explored outside current flow', page.locator('.detail-title').inner_text() == '상품 조회 API')
        page.locator('.detail-tabs [data-tab="evidence"]').click()
        check('evidence is visible', '설명용 소스 관계' in page.locator('.details').inner_text())
        page.locator('#search').fill('모바일 주문 상세')
        page.locator('[data-hit="mobile.order"]').click()
        check('global search finds hidden mobile node', page.locator('.detail-title').inner_text() == '모바일 주문 상세')
        check('search clears prior neighborhood filter', '모바일' in page.locator('h1').inner_text() and page.locator('[data-node="mobile.home"]').count()==1)
        page.screenshot(path=str(out/'03-mobile.png'))
        page.locator('[data-mode="impact"]').click()
        check('impact report shows explicit legend', '가능성' in page.locator('.legend').inner_text())
        page.locator('[data-node="web.products"]').click()
        check('impact reason is displayed', '응답 필드 변경' in page.locator('.reason').inner_text())
        page.screenshot(path=str(out/'02-impact.png'))
        page.locator('#report-select').select_option('performance.catalog')
        check('performance estimates are not measurements', '추정' in page.locator('.loading-note').inner_text())
        page.locator('[data-mode="changes"]').click()
        page.wait_for_selector('[data-diff="0"]')
        check('not-run checks remain visible', '미실행' in page.locator('.scrollpage').inner_text())
        page.locator('[data-diff="0"]').click()
        page.wait_for_selector('.diff-list')
        check('snapshot comparison works', '추가' in page.locator('.diff-list').inner_text())
        page.screenshot(path=str(out/'04-changes.png'))
        page.locator('[data-mode="settings"]').click()
        page.locator('#labels-setting').check()
        page.locator('#list-setting').check()
        page.locator('[data-mode="map"]').click()
        check('accessible list view is usable', page.locator('.listview').count() == 1)
        page.locator('#list-toggle').click()
        page.locator('[data-category="all"]').click()
        page.locator('#save-view').click()
        page.locator('#bookmarks').click()
        check('bookmark can be saved', page.locator('[data-bookmark]').count() == 1)
        page.locator('[data-bookmark]').click()
        check('saved view is restored', page.locator('.canvas').count() == 1)
        page.locator('[data-node="web.products"]').click()
        page.locator('#ask-agent').click()
        page.wait_for_timeout(200)
        check('question CTA guides to existing chat', '기존 에이전트 대화창' in page.locator('#toast').inner_text())
        check('no embedded chat input', page.locator('textarea').count() == 0)
        if args.project:
            # Exercise the real agent-facing publish path, without pretending a model ran.
            def publish_graph(graph, expected):
                with tempfile.TemporaryDirectory(prefix='atlas-browser-') as temp:
                    candidate=pathlib.Path(temp)/'candidate.json'
                    candidate.write_text(json.dumps(graph, ensure_ascii=False))
                    r=subprocess.run(['node',str(ROOT/'bin/codeatlas.mjs'),'publish','--project',args.project,'--file',str(candidate),'--expect',str(expected)],capture_output=True,text=True)
                    if r.returncode:raise RuntimeError(r.stderr)
                    return json.loads(r.stdout)['revision']
            updated=json.loads(json.dumps(baseline))
            unsafe_label='<img src=x onerror="window.__atlasInjected=1">'
            for node in updated['nodes']:
                if node['id']=='web.products':node['label']=unsafe_label
            revision=publish_graph(updated,baseline['revision'])
            page.wait_for_function("""(label)=>document.querySelector('[data-node=\"web.products\"] .node-title')?.textContent===label""",arg=unsafe_label)
            check('published graph automatically refreshes', page.locator('[data-node="web.products"] .node-title').inner_text()==unsafe_label)
            check('untrusted labels are text not HTML', page.locator('[data-node="web.products"] img').count()==0 and page.evaluate('window.__atlasInjected!==1'))
            check('previous selection becomes explicitly stale', page.locator('.warning-text').count()==1)
            page.locator('[data-node="web.products"]').click()
            page.wait_for_function('()=>!document.querySelector(".warning-text")')
            check('reselection acknowledges latest revision', page.locator('.warning-text').count()==0)
            revision=publish_graph(baseline,revision)
            page.wait_for_function("""()=>document.querySelector('[data-node=\"web.products\"] .node-title')?.textContent==='상품 목록'""")
            check('real publish restores original graph without reset', revision==baseline['revision']+2)
            page.locator('[data-node="web.products"]').click()
            page.wait_for_timeout(200)
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(220)
        check('narrow viewport has no horizontal page overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(out/'05-narrow.png'))
        page.locator('[data-close]').click()
        page.locator('.menu-toggle').click()
        check('mobile navigation drawer opens', 'open' in page.locator('.sidebar').get_attribute('class'))
        check('no unhandled browser exceptions', errors == [])
        browser.close()
    report={'checks':len(checks),'passed':checks,'pageErrors':errors,'mode':'embedded DOM + actual local HTTP bridge (not native host or browser-network validation)' if args.embedded else 'live browser navigation','timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
