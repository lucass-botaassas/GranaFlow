/**
 * ==========================================================================
 * GRANAFLOW — BANCO DE DADOS LOCAL (IndexedDB)
 * 100% Offline, Persistente e Seguro
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var DB_NAME = 'GranaFlowDB';
  var DB_VERSION = 1;
  var dbInstance = null;

  var STORES = [
    'events',
    'expenses',
    'fixed_expenses',
    'goals',
    'investments',
    'tasks',
    'weekly_closures',
    'categories',
    'settings'
  ];

  var defaultCategories = [
    { name: 'Alimentação', type: 'expense', color: '#F59E0B', icon: '🍽️' },
    { name: 'Transporte', type: 'expense', color: '#0EA5E9', icon: '🚗' },
    { name: 'Moradia', type: 'expense', color: '#8B5CF6', icon: '🏠' },
    { name: 'Internet', type: 'expense', color: '#38BDF8', icon: '🌐' },
    { name: 'Celular', type: 'expense', color: '#6366F1', icon: '📱' },
    { name: 'Lazer', type: 'expense', color: '#EC4899', icon: '🎉' },
    { name: 'Compras', type: 'expense', color: '#14B8A6', icon: '🛍️' },
    { name: 'Saúde', type: 'expense', color: '#EF4444', icon: '💊' },
    { name: 'Estudos', type: 'expense', color: '#10B981', icon: '📚' },
    { name: 'Assinaturas', type: 'expense', color: '#A855F7', icon: '📺' },
    { name: 'Outros', type: 'expense', color: '#64748B', icon: '🏷️' },
    { name: 'Eventos / Festas', type: 'income', color: '#10B981', icon: '🎤' },
    { name: 'Investimentos', type: 'income', color: '#38BDF8', icon: '📈' },
    { name: 'Outras Entradas', type: 'income', color: '#6366F1', icon: '💵' }
  ];

  var defaultSettings = {
    normalEventValue: 10000, // R$ 100,00 em centavos
    soloEventValue: 15000,   // R$ 150,00 em centavos
    appPin: null,
    pinEnabled: false,
    userName: 'Minhas Finanças'
  };

  var DB = {
    init: function () {
      return new Promise(function (resolve, reject) {
        if (dbInstance) {
          return resolve(dbInstance);
        }

        if (!window.indexedDB) {
          console.error('IndexedDB não suportado neste navegador!');
          return reject(new Error('IndexedDB não suportado'));
        }

        var request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function (event) {
          var db = event.target.result;

          STORES.forEach(function (storeName) {
            if (!db.objectStoreNames.contains(storeName)) {
              if (storeName === 'settings') {
                db.createObjectStore(storeName, { keyPath: 'key' });
              } else {
                var store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                if (storeName === 'events') {
                  store.createIndex('date', 'date', { unique: false });
                  store.createIndex('status', 'status', { unique: false });
                } else if (storeName === 'expenses') {
                  store.createIndex('date', 'date', { unique: false });
                  store.createIndex('category', 'category', { unique: false });
                  store.createIndex('status', 'status', { unique: false });
                } else if (storeName === 'tasks') {
                  store.createIndex('date', 'date', { unique: false });
                }
              }
            }
          });
        };

        request.onsuccess = function (event) {
          dbInstance = event.target.result;
          // Seed de categorias e configurações iniciais se vazias
          DB.seedDefaults().then(function () {
            resolve(dbInstance);
          }).catch(function (err) {
            console.warn('Erro ao inicializar defaults:', err);
            resolve(dbInstance);
          });
        };

        request.onerror = function (event) {
          console.error('Erro ao abrir IndexedDB:', event.target.error);
          reject(event.target.error);
        };
      });
    },

    seedDefaults: function () {
      return new Promise(function (resolve) {
        DB.getAll('categories').then(function (cats) {
          if (!cats || cats.length === 0) {
            var promises = defaultCategories.map(function (c) {
              return DB.add('categories', c);
            });
            return Promise.all(promises);
          }
        }).then(function () {
          return DB.getAll('settings');
        }).then(function (settings) {
          if (!settings || settings.length === 0) {
            var promises = Object.keys(defaultSettings).map(function (k) {
              return DB.setSetting(k, defaultSettings[k]);
            });
            return Promise.all(promises);
          }
        }).then(resolve).catch(resolve);
      });
    },

    getAll: function (storeName) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction(storeName, 'readonly');
          var store = tx.objectStore(storeName);
          var request = store.getAll();

          request.onsuccess = function () {
            resolve(request.result || []);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    getById: function (storeName, id) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction(storeName, 'readonly');
          var store = tx.objectStore(storeName);
          var request = store.get(id);

          request.onsuccess = function () {
            resolve(request.result);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    add: function (storeName, item) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction(storeName, 'readwrite');
          var store = tx.objectStore(storeName);
          var itemCopy = Object.assign({}, item);
          if (!itemCopy.createdAt) {
            itemCopy.createdAt = new Date().toISOString();
          }
          var request = store.add(itemCopy);

          request.onsuccess = function () {
            resolve(request.result);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    update: function (storeName, item) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction(storeName, 'readwrite');
          var store = tx.objectStore(storeName);
          var itemCopy = Object.assign({}, item);
          itemCopy.updatedAt = new Date().toISOString();
          var request = store.put(itemCopy);

          request.onsuccess = function () {
            resolve(request.result);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    delete: function (storeName, id) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction(storeName, 'readwrite');
          var store = tx.objectStore(storeName);
          var request = store.delete(id);

          request.onsuccess = function () {
            resolve(true);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    clearStore: function (storeName) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction(storeName, 'readwrite');
          var store = tx.objectStore(storeName);
          var request = store.clear();

          request.onsuccess = function () {
            resolve(true);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    getSetting: function (key, defaultValue) {
      return new Promise(function (resolve) {
        DB.getById('settings', key).then(function (res) {
          if (res && res.value !== undefined) {
            resolve(res.value);
          } else {
            resolve(defaultValue !== undefined ? defaultValue : null);
          }
        }).catch(function () {
          resolve(defaultValue !== undefined ? defaultValue : null);
        });
      });
    },

    setSetting: function (key, value) {
      return new Promise(function (resolve, reject) {
        DB.init().then(function (db) {
          var tx = db.transaction('settings', 'readwrite');
          var store = tx.objectStore('settings');
          var request = store.put({ key: key, value: value });

          request.onsuccess = function () {
            resolve(true);
          };
          request.onerror = function () {
            reject(request.error);
          };
        }).catch(reject);
      });
    },

    exportAllData: function () {
      return new Promise(function (resolve, reject) {
        var exportObj = {
          appName: 'GranaFlow',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          data: {}
        };

        var promises = STORES.map(function (store) {
          return DB.getAll(store).then(function (items) {
            exportObj.data[store] = items;
          });
        });

        Promise.all(promises).then(function () {
          resolve(exportObj);
        }).catch(reject);
      });
    },

    importAllData: function (importObj) {
      return new Promise(function (resolve, reject) {
        if (!importObj || !importObj.data) {
          return reject(new Error('Arquivo de backup inválido'));
        }

        var storesToImport = Object.keys(importObj.data);
        var clearPromises = storesToImport.map(function (store) {
          return DB.clearStore(store);
        });

        Promise.all(clearPromises).then(function () {
          var addPromises = [];
          storesToImport.forEach(function (store) {
            var items = importObj.data[store] || [];
            items.forEach(function (item) {
              addPromises.push(DB.add(store, item));
            });
          });
          return Promise.all(addPromises);
        }).then(function () {
          resolve(true);
        }).catch(reject);
      });
    }
  };

  window.AppDB = DB;
})(window);
