/**
 * AutoCaption Project Storage Engine
 * Dual-layer offline-first persistence using IndexedDB with localStorage fallback and FastAPI backend sync.
 */

const DB_NAME = 'autocaption_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const STORAGE_KEY_LOCAL = 'autocaption_projects_cache';
const BACKEND_URL = 'http://127.0.0.1:8000';

export const INITIAL_SHOWCASE_PROJECTS = [];

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProjects() {
  const isDemoPlaceholder = (id) => typeof id === 'string' && /^proj-[1-8]$/.test(id);

  // 1. Authoritative: Fetch all saved projects from backend storage/projects
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.projects) && data.projects.length > 0) {
        const backendProjects = data.projects.filter(p => !isDemoPlaceholder(p.id));
        
        // Sync to IndexedDB for seamless offline caching
        try {
          const db = await openIndexedDB();
          const writeTx = db.transaction(STORE_NAME, 'readwrite');
          const writeStore = writeTx.objectStore(STORE_NAME);
          backendProjects.forEach(p => writeStore.put(p));
        } catch (_) {}

        backendProjects.sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0));
        return backendProjects;
      }
    }
  } catch (backendErr) {
    console.warn('Backend projects fetch error, falling back to local storage:', backendErr);
  }

  // 2. Fallback: IndexedDB
  try {
    const db = await openIndexedDB();
    const projects = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (projects && projects.length > 0) {
      // Purge any legacy demo placeholders from IndexedDB
      const realProjects = projects.filter(p => !isDemoPlaceholder(p.id));
      const placeholders = projects.filter(p => isDemoPlaceholder(p.id));
      if (placeholders.length > 0) {
        try {
          const writeTx = db.transaction(STORE_NAME, 'readwrite');
          const writeStore = writeTx.objectStore(STORE_NAME);
          placeholders.forEach(p => writeStore.delete(p.id));
        } catch (_) {}
      }

      realProjects.sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0));
      return realProjects;
    }
  } catch (err) {
    console.warn('IndexedDB read failed, checking localStorage fallback:', err);
  }

  // 3. Fallback: localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOCAL);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const realProjects = parsed.filter(p => !isDemoPlaceholder(p.id));
        localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(realProjects));
        realProjects.sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0));
        return realProjects;
      }
    }
  } catch (e) {
    console.warn('localStorage read error:', e);
  }

  return [];
}

export async function getProjectById(id) {
  if (!id) return null;

  // 1. Try backend
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects/${id}`);
    if (res.ok) {
      const proj = await res.json();
      if (proj && proj.id) {
        try {
          const db = await openIndexedDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(proj);
        } catch (_) {}
        return proj;
      }
    }
  } catch (e) {}

  // 2. Try IndexedDB
  try {
    const db = await openIndexedDB();
    const proj = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (proj) return proj;
  } catch (err) {
    console.warn('IndexedDB get failed:', err);
  }

  const all = await getAllProjects();
  return all.find(p => p.id === id) || null;
}

export async function saveProject(project) {
  if (!project || !project.id) return;
  const now = new Date().toISOString();
  const fullProj = {
    ...project,
    updatedAt: now,
    createdAt: project.createdAt || now
  };

  try {
    const db = await openIndexedDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fullProj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, using localStorage:', err);
  }

  // Also sync summary to localStorage
  try {
    const all = await getAllProjects();
    const idx = all.findIndex(p => p.id === fullProj.id);
    if (idx >= 0) {
      all[idx] = fullProj;
    } else {
      all.unshift(fullProj);
    }
    // Clean large media blobs from localStorage cache
    const light = all.map(p => ({
      ...p,
      segments: (p.segments || []).slice(0, 50) // truncate large segments in localStorage
    }));
    localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(light));
  } catch (e) {
    console.warn('localStorage save warning:', e);
  }

  // Async backend sync if available
  try {
    fetch(`${BACKEND_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullProj)
    }).catch(() => {});
  } catch (e) {}

  return fullProj;
}

export async function deleteProject(id) {
  if (!id) return;
  try {
    const db = await openIndexedDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOCAL);
    if (saved) {
      const all = JSON.parse(saved);
      const filtered = all.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(filtered));
    }
  } catch (e) {}

  try {
    fetch(`${BACKEND_URL}/api/projects/${id}`, { method: 'DELETE' }).catch(() => {});
  } catch (e) {}
}

export async function seedInitialProjects() {
  // No placeholder seeding
}
