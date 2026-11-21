let connection;
async function db() {
  if (!connection) connection = new Promise((resolve,reject) => {
    const r = indexedDB.open('scenario-player-v1',1);
    r.onupgradeneeded = () => r.result.createObjectStore('bundles',{keyPath:'id'});
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }).catch(e => { connection = null; throw e; });
  return connection;
}
async function request(mode, operation) {
  const tx = (await db()).transaction('bundles',mode);
  return new Promise((resolve,reject) => {
    const r = operation(tx.objectStore('bundles'));
    tx.oncomplete = () => resolve(r.result);
    tx.onabort = () => reject(tx.error || Error('저장 취소'));
    tx.onerror = () => reject(tx.error);
  });
}
export const bundles = {
  put: row => request('readwrite',s => s.put(row)),
  remove: id => request('readwrite',s => s.delete(id)),
  ids: () => request('readonly',s => s.getAllKeys()),
  get: id => request('readonly',s => s.get(id))
};
export function slot(id,n,state) {
  const key = 'scenario:v1:'+id+':'+n;
  if (state) localStorage.setItem(key,JSON.stringify(state));
  else return JSON.parse(localStorage.getItem(key));
}
