'use strict';
(function () {
  const API = String(window.ADMIN_API_URL || '').replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  const status = $('status');
  const view = $('view');

  // Builds elements with textContent only, so server data is never parsed as HTML.
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'onclick' || key === 'onchange' || key === 'onsubmit') {
        el[key] = value;
      } else if (value === true) {
        el.setAttribute(key, '');
      } else if (value !== false && value != null) {
        el.setAttribute(key, value);
      }
    }
    for (const child of children.flat()) {
      el.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
    }
    return el;
  }

  function say(message, kind) {
    status.textContent = message || '';
    status.className = kind || '';
  }

  const store = {
    get: (k) => sessionStorage.getItem(k),
    set: (k, v) => sessionStorage.setItem(k, v),
    clear: () => sessionStorage.clear(),
  };

  async function request(method, path, body, raw) {
    const send = () =>
      fetch(API + path, {
        method,
        headers: {
          ...(store.get('access') && {
            Authorization: 'Bearer ' + store.get('access'),
          }),
          ...(body !== undefined && {
            'Content-Type': raw ? 'text/csv' : 'application/json',
          }),
        },
        body:
          body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
    let response;
    try {
      response = await send();
      if (
        response.status === 401 &&
        store.get('refresh') &&
        path !== '/auth/login'
      ) {
        const refreshed = await fetch(API + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: store.get('refresh') }),
        });
        if (refreshed.ok) {
          const tokens = await refreshed.json();
          store.set('access', tokens.accessToken);
          store.set('refresh', tokens.refreshToken);
          response = await send();
        }
      }
    } catch {
      throw new Error('Server unreachable');
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login') logout();
      throw new Error(
        (data && data.error) || 'Request failed (' + response.status + ')',
      );
    }
    return data;
  }

  function logout() {
    store.clear();
    $('login').hidden = false;
    view.hidden = true;
    $('tabs').hidden = true;
    $('logout').hidden = true;
    view.replaceChildren();
  }

  async function guard(action) {
    try {
      await action();
    } catch (error) {
      say(error.message, 'error');
    }
  }

  // ---- Offers ----

  const OFFER_FIELDS = [
    ['title_sr', 'Title (SR)', 'text', true],
    ['title_en', 'Title (EN)', 'text'],
    ['category_sr', 'Category (SR)', 'text'],
    ['category_en', 'Category (EN)', 'text'],
    ['location_sr', 'Location (SR)', 'text'],
    ['location_en', 'Location (EN)', 'text'],
    ['priceAmount', 'Price', 'number'],
    ['startDate', 'Start date', 'date'],
    ['endDate', 'End date', 'date'],
    ['applicationDeadline', 'Application deadline', 'date'],
    ['availablePlaces', 'Available places', 'number'],
  ];
  const IMAGE_FIELDS = [
    'imageUrl',
    'imageUrl2',
    'imageUrl3',
    'imageUrl4',
    'imageUrl5',
  ];

  async function showOffers() {
    const offers = await request('GET', '/offers');
    view.replaceChildren(
      h('h2', {}, 'Offers'),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          { class: 'primary', type: 'button', onclick: () => offerForm(null) },
          'New offer',
        ),
      ),
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['ID', 'Title', 'Dates', 'Price', 'Places', ''].map((t) =>
              h('th', { scope: 'col' }, t),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          offers.map((o) =>
            h(
              'tr',
              {},
              h('td', {}, o.id),
              h('td', {}, o.title_sr),
              h('td', {}, [o.startDate, o.endDate].filter(Boolean).join(' – ')),
              h(
                'td',
                {},
                o.isPriceComingSoon
                  ? 'Coming soon'
                  : o.priceAmount != null
                    ? o.priceAmount + ' ' + (o.currency || '')
                    : '',
              ),
              h('td', {}, o.availablePlaces ?? ''),
              h(
                'td',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    'aria-label': 'Edit ' + o.title_sr,
                    onclick: () => offerForm(o),
                  },
                  'Edit',
                ),
                ' ',
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'danger',
                    'aria-label': 'Delete ' + o.title_sr,
                    onclick: () => guard(() => removeOffer(o)),
                  },
                  'Delete',
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  async function removeOffer(offer) {
    if (
      !confirm(
        'Delete "' +
          offer.title_sr +
          '"? Favorites pointing to it are removed too.',
      )
    )
      return;
    await request('DELETE', '/offers/' + offer.id);
    say('Offer deleted', 'ok');
    await showOffers();
  }

  function field(id, label, type, value, required) {
    return h(
      'div',
      {},
      h('label', { for: id }, label),
      h('input', {
        id,
        type,
        value: value ?? '',
        required: !!required,
        step: type === 'number' ? 'any' : null,
      }),
    );
  }

  function offerForm(offer) {
    const o = offer || { currency: 'EUR' };
    const form = h(
      'form',
      {
        class: 'card',
        onsubmit: (event) => {
          event.preventDefault();
          guard(() => saveOffer(offer));
        },
      },
      h('h2', {}, offer ? 'Edit offer ' + offer.id : 'New offer'),
      h(
        'div',
        { class: 'grid' },
        OFFER_FIELDS.map(([key, label, type, req]) =>
          field('f-' + key, label, type, o[key], req),
        ),
      ),
      h('label', { for: 'f-currency' }, 'Currency'),
      h(
        'select',
        { id: 'f-currency' },
        ['EUR', 'RSD'].map((c) =>
          h('option', { value: c, selected: o.currency === c }, c),
        ),
      ),
      h(
        'div',
        { class: 'check' },
        h('input', {
          id: 'f-soon',
          type: 'checkbox',
          checked: !!o.isPriceComingSoon,
        }),
        h('label', { for: 'f-soon' }, 'Price coming soon'),
      ),
      h('label', { for: 'f-description_sr' }, 'Description (SR)'),
      h(
        'textarea',
        { id: 'f-description_sr', rows: 4 },
        o.description_sr || '',
      ),
      h('label', { for: 'f-description_en' }, 'Description (EN)'),
      h(
        'textarea',
        { id: 'f-description_en', rows: 4 },
        o.description_en || '',
      ),
      h('h3', {}, 'Images (up to 5, first is the cover)'),
      IMAGE_FIELDS.map((key, i) =>
        field('f-' + key, 'Image URL ' + (i + 1), 'url', o[key]),
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'primary', type: 'submit' }, 'Save'),
        h(
          'button',
          { type: 'button', onclick: () => guard(showOffers) },
          'Cancel',
        ),
      ),
    );
    view.replaceChildren(form);
    $('f-title_sr').focus();
  }

  async function saveOffer(existing) {
    const val = (id) => $(id).value.trim();
    const body = {
      currency: $('f-currency').value,
      isPriceComingSoon: $('f-soon').checked,
    };
    for (const [key] of OFFER_FIELDS) body[key] = val('f-' + key) || null;
    for (const key of ['description_sr', 'description_en'])
      body[key] = val('f-' + key) || null;
    for (const key of IMAGE_FIELDS) body[key] = val('f-' + key) || null;
    if (body.priceAmount !== null) body.priceAmount = Number(body.priceAmount);
    if (body.availablePlaces !== null)
      body.availablePlaces = Number(body.availablePlaces);
    await request(
      existing ? 'PUT' : 'POST',
      existing ? '/offers/' + existing.id : '/offers',
      body,
    );
    say('Offer saved', 'ok');
    await showOffers();
  }

  // ---- CSV import ----

  function showImport() {
    const result = h('div', { 'aria-live': 'polite' });
    view.replaceChildren(
      h('h2', {}, 'CSV import'),
      h(
        'div',
        { class: 'card' },
        h(
          'p',
          {},
          'Header row required. Columns: title_sr, title_en, priceAmount, currency, category_sr, category_en, location_sr, location_en, startDate, endDate, description_sr, description_en, imageUrl, imageUrl2–5, availablePlaces, applicationDeadline, isPriceComingSoon.',
        ),
        h(
          'p',
          {},
          'Rows matching an existing offer (same title_sr and startDate) are updated; others are inserted. Offers missing from the file are never deleted.',
        ),
        h('label', { for: 'csv-file' }, 'CSV file'),
        h('input', { id: 'csv-file', type: 'file', accept: '.csv,text/csv' }),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'primary',
              type: 'button',
              onclick: () =>
                guard(async () => {
                  const file = $('csv-file').files[0];
                  if (!file) throw new Error('Choose a CSV file first');
                  const summary = await request(
                    'POST',
                    '/offers/import',
                    await file.text(),
                    true,
                  );
                  say('Import finished', 'ok');
                  result.replaceChildren(
                    h(
                      'p',
                      {},
                      'Inserted: ' +
                        summary.inserted +
                        ', updated: ' +
                        summary.updated +
                        ', failed: ' +
                        summary.failed,
                    ),
                    h(
                      'ul',
                      {},
                      summary.errors.map((e) => h('li', {}, e)),
                    ),
                  );
                }),
            },
            'Import',
          ),
        ),
        result,
      ),
    );
  }

  // ---- Users ----

  async function showUsers() {
    const users = await request('GET', '/users');
    const me = store.get('username');
    view.replaceChildren(
      h('h2', {}, 'Users'),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          { class: 'primary', type: 'button', onclick: () => userForm(null) },
          'New user',
        ),
      ),
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['Username', 'Name', 'Email', 'Role', 'Active', ''].map((t) =>
              h('th', { scope: 'col' }, t),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          users.map((u) =>
            h(
              'tr',
              {},
              h('td', {}, u.username),
              h('td', {}, [u.name, u.surname].filter(Boolean).join(' ')),
              h('td', {}, u.email),
              h('td', {}, u.isAdmin ? 'Admin' : 'User'),
              h('td', {}, u.isActive ? 'Yes' : 'No'),
              h(
                'td',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    'aria-label': 'Edit ' + u.username,
                    onclick: () => userForm(u),
                  },
                  'Edit',
                ),
                ' ',
                u.username === me
                  ? ''
                  : h(
                      'button',
                      {
                        type: 'button',
                        class: 'danger',
                        'aria-label': 'Delete ' + u.username,
                        onclick: () => guard(() => removeUser(u)),
                      },
                      'Delete',
                    ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  async function removeUser(user) {
    if (!confirm('Delete user "' + user.username + '" and their favorites?'))
      return;
    await request('DELETE', '/users/' + encodeURIComponent(user.username));
    say('User deleted', 'ok');
    await showUsers();
  }

  function userForm(user) {
    const u = user || { isActive: true };
    const self = user && user.username === store.get('username');
    view.replaceChildren(
      h(
        'form',
        {
          class: 'card',
          onsubmit: (event) => {
            event.preventDefault();
            guard(() => saveUser(user));
          },
        },
        h('h2', {}, user ? 'Edit user' : 'New user'),
        h('div', { class: 'grid' }, [
          field('u-username', 'Username', 'text', u.username, true),
          field('u-name', 'Name', 'text', u.name),
          field('u-surname', 'Surname', 'text', u.surname),
          field('u-email', 'Email', 'email', u.email, true),
          field(
            'u-password',
            user ? 'New password (leave empty to keep)' : 'Password',
            'password',
            '',
            !user,
          ),
        ]),
        h(
          'div',
          { class: 'check' },
          h('input', {
            id: 'u-admin',
            type: 'checkbox',
            checked: !!u.isAdmin,
            disabled: !!self,
          }),
          h('label', { for: 'u-admin' }, 'Administrator'),
        ),
        h(
          'div',
          { class: 'check' },
          h('input', {
            id: 'u-active',
            type: 'checkbox',
            checked: u.isActive !== false,
            disabled: !!self,
          }),
          h('label', { for: 'u-active' }, 'Active'),
        ),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'primary', type: 'submit' }, 'Save'),
          h(
            'button',
            { type: 'button', onclick: () => guard(showUsers) },
            'Cancel',
          ),
        ),
      ),
    );
    $('u-username').focus();
    if (self) $('u-username').disabled = true;
  }

  async function saveUser(existing) {
    const val = (id) => $(id).value.trim();
    const body = {
      username: val('u-username'),
      name: val('u-name'),
      surname: val('u-surname'),
      email: val('u-email'),
      isAdmin: $('u-admin').checked,
      isActive: $('u-active').checked,
    };
    const password = $('u-password').value;
    if (existing) {
      if (existing.username === store.get('username')) {
        delete body.username;
        delete body.isAdmin;
        delete body.isActive;
      }
      if (password) body.newPassword = password;
      await request(
        'PATCH',
        '/users/' + encodeURIComponent(existing.username),
        body,
      );
    } else {
      body.password = password;
      await request('POST', '/users', body);
    }
    say('User saved', 'ok');
    await showUsers();
  }

  // ---- Shell ----

  const tabs = {
    offers: showOffers,
    import: async () => showImport(),
    users: showUsers,
  };

  function openTab(name) {
    say('');
    for (const button of document.querySelectorAll('#tabs button')) {
      if (button.dataset.tab === name)
        button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    guard(tabs[name]);
  }

  for (const button of document.querySelectorAll('#tabs button')) {
    button.onclick = () => openTab(button.dataset.tab);
  }
  $('logout').onclick = () => {
    logout();
    say('');
  };

  function enter() {
    $('login').hidden = true;
    view.hidden = false;
    $('tabs').hidden = false;
    $('logout').hidden = false;
    openTab('offers');
  }

  $('login-form').onsubmit = (event) => {
    event.preventDefault();
    guard(async () => {
      const data = await request('POST', '/auth/login', {
        username: $('login-username').value.trim(),
        password: $('login-password').value,
      });
      if (!data.user.isAdmin) {
        throw new Error('This account is not an administrator');
      }
      store.set('access', data.accessToken);
      store.set('refresh', data.refreshToken);
      store.set('username', data.user.username);
      $('login-password').value = '';
      say('');
      enter();
    });
  };

  if (store.get('access')) enter();
})();
