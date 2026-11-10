import { ApiError, api, guestStore, session } from './api.js';
import { $, $$, clear, el } from './dom.js';
import { errorText } from './messages.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/**
 * ¿Quién juega al abrir la app? Una cuenta con token válido, un invitado guardado, o nadie (null).
 * Un token vencido (401) se borra; si el servidor no responde, se sigue con el invitado guardado si lo hay.
 * @returns {Promise<{kind:'user', user:object}|{kind:'guest', name:string, avatar:string}|null>}
 */
export async function restoreIdentity() {
  if (session.token) {
    try { return { kind: 'user', user: (await api.me()).user }; } catch (err) { if (err instanceof ApiError && err.status === 401) session.clear(); }
  }
  const guest = guestStore.get();
  return guest ? { kind: 'guest', ...guest } : null;
}

/** Pantalla de entrada: iniciar sesión, crear cuenta (en el mismo formulario) o entrar como invitado. */
export class Welcome {
  /** @param {{onSignedIn:(user:object)=>void, onGuest:(g:{name:string, avatar:string})=>void, onBack:()=>void}} deps */
  constructor({ onSignedIn, onGuest, onBack }) {
    this.onSignedIn = onSignedIn;
    this.onGuest = onGuest;
    this.onBack = onBack;
    this.mode = 'login';
    this.avatar = '';
    this.upgrade = false;
    this.#bind();
  }

  init(meta) {
    const avatars = meta?.avatars ?? [];
    this.avatar = avatars[0] ?? '';
    for (const sel of ['#auth-avatars', '#guest-avatars']) {
      const box = clear($(sel));
      avatars.forEach((a, i) => box.append(el('button', {
        type: 'button', class: 'avatar-opt', role: 'radio', 'aria-checked': String(i === 0), 'aria-label': `Avatar ${a}`, dataset: { a },
      }, a)));
    }
  }

  /**
   * Prepara la pantalla cada vez que se muestra.
   * @param {{upgrade?:boolean, guest?:{name:string, avatar:string}|null}} opts  upgrade: un invitado viene a crear cuenta o iniciar sesión
   */
  open({ upgrade = false, guest = null } = {}) {
    this.upgrade = upgrade;
    $('#auth-cancel').hidden = !upgrade;
    $('#auth-pass').value = '';
    this.#showGuestForm(false);
    if (guest) {
      $('#guest-name').value = guest.name;
      if (guest.avatar) this.#selectAvatar(guest.avatar);
    }
    this.setMode('login');
  }

  /** Alterna entre «Iniciar sesión» y «Crear cuenta» sin salir de la pantalla. */
  setMode(mode, { focus = true } = {}) {
    this.mode = mode;
    const register = mode === 'register';
    $('#auth-title').textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
    $('#auth-submit').textContent = register ? 'Crear cuenta' : 'Entrar';
    $('#auth-switch').textContent = register ? 'Ya tengo cuenta: iniciar sesión' : 'No tengo cuenta: crear una';
    $('#auth-user-field').hidden = !register;
    $('#auth-user').required = register;
    $('#auth-avatar-field').hidden = !register;
    $('#auth-pass-hint').hidden = !register;
    $('#auth-pass').setAttribute('autocomplete', register ? 'new-password' : 'current-password');
    this.#setPassVisible(false);
    this.#clearAuthErrors();
    if (focus) $('#auth-email').focus();
  }

  #selectAvatar(avatar) {
    this.avatar = avatar;
    $$('.avatar-opt').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.a === avatar)));
  }

  #bind() {
    const onAvatarClick = (e) => {
      const b = e.target.closest('.avatar-opt');
      if (b) this.#selectAvatar(b.dataset.a);
    };
    const onAvatarKey = (e) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
      const opts = [...e.currentTarget.querySelectorAll('.avatar-opt')];
      const cur = opts.indexOf(e.target.closest('.avatar-opt'));
      if (cur === -1) return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const next = opts[(cur + step + opts.length) % opts.length];
      this.#selectAvatar(next.dataset.a);
      next.focus();
    };
    for (const sel of ['#auth-avatars', '#guest-avatars']) {
      $(sel).addEventListener('click', onAvatarClick);
      $(sel).addEventListener('keydown', onAvatarKey);
    }

    $('#auth-switch').addEventListener('click', () => this.setMode(this.mode === 'login' ? 'register' : 'login'));
    $('#auth-cancel').addEventListener('click', () => this.onBack());
    $('#auth-pass-toggle').addEventListener('click', () => {
      this.#setPassVisible($('#auth-pass').type === 'password');
      $('#auth-pass').focus();
    });
    const fields = [['#auth-email', '#auth-email-error'], ['#auth-user', '#auth-user-error'], ['#auth-pass', '#auth-pass-error'], ['#guest-name', '#guest-name-error']];
    for (const [inp, err] of fields) {
      $(inp).addEventListener('input', () => {
        $(inp).removeAttribute('aria-invalid');
        $(err).hidden = true;
        $(err).textContent = '';
      });
    }
    $('#auth-form').addEventListener('submit', (e) => { e.preventDefault(); this.#submitAuth(); });

    $('#btn-guest').addEventListener('click', () => this.#showGuestForm(true));
    $('#guest-form').addEventListener('submit', (e) => { e.preventDefault(); this.#submitGuest(); });
  }

  // ---------------------------------------------------------------- invitado
  #showGuestForm(show) {
    $('#guest-form').hidden = !show;
    $('#btn-guest').setAttribute('aria-expanded', String(show));
    $('#guest-name').removeAttribute('aria-invalid');
    $('#guest-name-error').hidden = true;
    if (show) $('#guest-name').focus();
  }

  #submitGuest() {
    const name = $('#guest-name').value.trim().slice(0, 16);
    if (!name) {
      const err = $('#guest-name-error');
      err.textContent = 'Escribe un nombre para jugar como invitado.';
      err.hidden = false;
      $('#guest-name').setAttribute('aria-invalid', 'true');
      $('#guest-name').focus();
      return;
    }
    this.onGuest({ name, avatar: this.avatar });
  }

  // ---------------------------------------------------------------- cuenta
  #setPassVisible(visible) {
    const toggle = $('#auth-pass-toggle');
    $('#auth-pass').type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    toggle.textContent = visible ? 'Ocultar' : 'Mostrar';
  }

  #clearAuthErrors() {
    for (const id of ['#auth-email-error', '#auth-user-error', '#auth-pass-error', '#auth-error']) {
      $(id).hidden = true;
      $(id).textContent = '';
    }
    for (const id of ['#auth-email', '#auth-user', '#auth-pass']) $(id).removeAttribute('aria-invalid');
  }

  #showAuthError(code) {
    this.#clearAuthErrors();
    const msg = code === 'sin_conexion' ? 'No se pudo conectar con el servidor.' : errorText(code);
    let fieldInput = null;
    let fieldErr = null;
    if (code === 'correo_invalido' || code === 'correo_ocupado') {
      fieldInput = $('#auth-email'); fieldErr = $('#auth-email-error');
    } else if (code === 'usuario_invalido' || code === 'usuario_ocupado') {
      fieldInput = $('#auth-user'); fieldErr = $('#auth-user-error');
    } else if (code === 'password_corta' || code === 'password_larga') {
      fieldInput = $('#auth-pass'); fieldErr = $('#auth-pass-error');
    } else if (code === 'credenciales_invalidas') {
      $('#auth-email').setAttribute('aria-invalid', 'true');
      fieldInput = $('#auth-pass'); fieldErr = $('#auth-pass-error');
    }
    if (fieldErr) {
      fieldErr.textContent = msg;
      fieldErr.hidden = false;
      fieldInput.setAttribute('aria-invalid', 'true');
      fieldInput.focus();
    } else {
      // Errores que no son de un campo (sin conexión, demasiados intentos…): mensaje general bajo el formulario.
      $('#auth-error').textContent = msg;
      $('#auth-error').hidden = false;
    }
  }

  async #submitAuth() {
    this.#clearAuthErrors();
    const email = $('#auth-email').value.trim().toLowerCase();
    const username = $('#auth-user').value.trim();
    const password = $('#auth-pass').value;

    if (!EMAIL_RE.test(email)) return this.#showAuthError('correo_invalido');
    if (this.mode === 'register') {
      if (!USERNAME_RE.test(username)) return this.#showAuthError('usuario_invalido');
      if (password.length < 8) return this.#showAuthError('password_corta');
    } else if (!password) {
      return this.#showAuthError('credenciales_invalidas');
    }

    try {
      const res = this.mode === 'register'
        ? await api.register({ email, username, password, avatar: this.avatar })
        : await api.login({ email, password });
      session.save(res.token);
      $('#auth-pass').value = '';
      this.#setPassVisible(false);
      this.onSignedIn(res.user);
    } catch (e) {
      this.#showAuthError(e instanceof ApiError ? e.code : 'error');
    }
  }
}

