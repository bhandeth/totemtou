// Shared storage layer — Supabase primary, localStorage write-through cache.
// All pages load this after the Supabase CDN script.
//
// API:
//   TTStorage.getItem(key)         → Promise<value | null>
//   TTStorage.setItem(key, value)  → void (localStorage instant, Supabase async)
(function (global) {
  const SUPABASE_URL = 'https://snopshetvnvuuxemxucs.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_B4s7RvHfO-7KQA1xRgD_cw_LXksgayV';

  let _client = null;
  function sb() {
    if (!_client && window.supabase) {
      _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _client;
  }

  // Returns parsed JS value, or null if nothing found.
  async function getItem(key) {
    const client = sb();
    if (client) {
      try {
        const { data, error } = await client
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();
        if (!error && data != null) {
          localStorage.setItem(key, JSON.stringify(data.value));
          return data.value;
        }
      } catch (_) {}
    }
    // Offline / Supabase unavailable — fall back to local cache.
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // Writes localStorage immediately for instant UI response,
  // then syncs to Supabase in the background.
  function setItem(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    const client = sb();
    if (!client) return;
    client
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .then(function (res) {
        if (res.error) {
          console.warn('[TTStorage] Supabase write failed for key:', key, res.error.message);
        }
      });
  }

  global.TTStorage = { getItem: getItem, setItem: setItem };
})(window);
