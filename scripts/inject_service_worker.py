from argparse import ArgumentParser
from bs4 import BeautifulSoup

code = """
if ('serviceWorker' in navigator) {
    const scope = location.pathname.replace(/\/[^\/]+$/, '/');
    navigator.serviceWorker.register('/ngapp/sw.js', { scope: '/ngapp/', type: 'module' })
             .then(function(reg) {
                 reg.addEventListener('updatefound', function() {
                     const installingWorker = reg.installing;
                     console.log('A new service worker is being installed:',
                                 installingWorker);
                 });
                 // registration worked
                 console.log('Registration succeeded. Scope is ' + reg.scope);
             }).catch(function(error) {
                 // registration failed
                 console.log('Registration failed with ' + error);
             });
}
"""

p = ArgumentParser("Inject service worker into a html file.")
p.add_argument('-i', '--input', default='index.html')
p.add_argument('-o', '--output', default=None)
p.add_argument('-s', '--script', default='sw.js')
args = p.parse_args()

code = code.replace('sw.js', args.script)

with open(args.input, "rt") as f:
  html = BeautifulSoup(f.read())

script = html.new_tag('script')
script.append(code)
html.find('head').insert(0, script)

a = html.new_tag('a', href="wayne/hello")
a.append('Hello')
d = html.new_tag('div', style="height:128px;")
d.append(a)
html.find('body').insert(0, d)

with open(args.output or args.input, "wt") as f:
  f.write(html.prettify())
