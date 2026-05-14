class I18n {
  constructor() {
    this.translations = {};
    this.currentLang = 'es';
    this.fallbackLang = 'es';
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  async load(lang) {
    this.currentLang = lang;
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (!res.ok) throw new Error('Not found');
      this.translations = await res.json();
    } catch (e) {
      if (lang !== this.fallbackLang) {
        await this.load(this.fallbackLang);
        return;
      }
      this.translations = {};
    }
    this.listeners.forEach(fn => fn(this.currentLang));
  }

  t(key, params) {
    const keys = key.split('.');
    let value = this.translations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }
    if (typeof value === 'string') {
      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, p1) =>
          params[p1] !== undefined ? params[p1] : match
        );
      }
      return value;
    }
    return key;
  }
}

window.I18n = new I18n();
