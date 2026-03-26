const HISTORY_DB_NAME = "backless-history-db";
const HISTORY_STORE_NAME = "history_entries";
const HISTORY_LOCAL_KEY = "backless_history";

function getHistoryScope(user) {
  return user?.uid ? `user:${user.uid}` : "guest";
}

function openHistoryDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(HISTORY_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        database.createObjectStore(HISTORY_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open history database."));
  });
}

function readHistoryFromLocalStorage() {
  try {
    const savedHistory = localStorage.getItem(HISTORY_LOCAL_KEY);
    return savedHistory ? JSON.parse(savedHistory) : [];
  } catch {
    localStorage.removeItem(HISTORY_LOCAL_KEY);
    return [];
  }
}

function writeHistoryToLocalStorage(history) {
  try {
    localStorage.setItem(HISTORY_LOCAL_KEY, JSON.stringify(history));
  } catch {
    // Ignore localStorage quota issues for guest history.
  }
}

export async function loadPersistedHistory(user) {
  const scope = getHistoryScope(user);

  if (scope === "guest") {
    return readHistoryFromLocalStorage();
  }

  try {
    const database = await openHistoryDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(HISTORY_STORE_NAME, "readonly");
      const store = transaction.objectStore(HISTORY_STORE_NAME);
      const request = store.get(scope);

      request.onsuccess = () => {
        database.close();
        resolve(Array.isArray(request.result) ? request.result : []);
      };

      request.onerror = () => {
        database.close();
        reject(request.error ?? new Error("Failed to read saved history."));
      };
    });
  } catch {
    return readHistoryFromLocalStorage();
  }
}

export async function savePersistedHistory(user, history) {
  const scope = getHistoryScope(user);

  if (scope === "guest") {
    writeHistoryToLocalStorage(history);
    return;
  }

  try {
    const database = await openHistoryDatabase();

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
      const store = transaction.objectStore(HISTORY_STORE_NAME);

      transaction.oncomplete = () => {
        database.close();
        resolve();
      };

      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("Failed to save history."));
      };

      store.put(history, scope);
    });
  } catch {
    writeHistoryToLocalStorage(history);
  }
}
