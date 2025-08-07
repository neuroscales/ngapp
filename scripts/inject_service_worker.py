from argparse import ArgumentParser
from bs4 import BeautifulSoup

code = """
if ('serviceWorker' in navigator) {
    const scope = location.pathname.replace(/\/[^\/]+$/, '/');
    navigator.serviceWorker.register('sw.js', { scope })
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
args = p.parse()

code = code.replace('sw.js', args.script)

with open(args.input, "rt") as f:
  html = BeautifulSoup(f.read())

meta = html.find('meta')
script = html.new_tag('script')
script.append(code)
meta.insert(0, script)

with open(args.output or args.input, "wt") as f:
  f.write(html.prettify())
