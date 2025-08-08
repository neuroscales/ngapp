self.addEventListener('fetch', (event) => {
  console.log("fetch event:", event);
  console.log("fetch url:", event.request.url);
  event.respondWith((async () => { return await fetch(event.request) })());
});
