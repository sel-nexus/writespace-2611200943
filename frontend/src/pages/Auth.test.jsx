/** Exercise controlled auth forms, role navigation, avatars and activated logout. */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { SESSION_KEY, USERS_KEY, readSession, readUsers, writeSession } from '../utils/storage.js';
const identity = { userId: 'u1', username:'mira', displayName:'Mira', role:'user' };
/** Expose the exact router address for navigation assertions. */
function Address() { return <output aria-label="Current address">{useLocation().pathname}</output>; }
/** Compose forms and representative test-only homes inside a real router. */
function authView(path='/login') {
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Address />
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/blogs" element={<p>Writer destination</p>} />
          <Route path="/admin" element={<p>Admin destination</p>} />
          <Route path="/users" element={<p>Accounts destination</p>} />
          <Route path="/write" element={<p>Write destination</p>} />
          <Route path="/" element={<p>Public destination</p>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );
}
/** Fill registration through labelled fields with opaque demonstration text. */
async function fillRegistration(user) {
  await user.type(screen.getByLabelText('Display name'),' Mira ');
  await user.type(screen.getByLabelText('Username'),' mira ');
  await user.type(screen.getByLabelText('Password'),' demo ');
  await user.type(screen.getByLabelText('Confirm password'),' demo ');
}
describe('auth forms', () => {
  it('does not write or remove anything on strict render and rerender', () => {
    const write=vi.spyOn(Storage.prototype,'setItem');
    const remove=vi.spyOn(Storage.prototype,'removeItem');
    authView('/register');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
  it.each(['/login','/register'])('associates required errors with each field on %s', async (path) => {
    const user=userEvent.setup();authView(path);
    await user.click(screen.getByRole('button',{name:path==='/login'?'Log in':'Register',exact:true}));
    for (const label of path==='/login'?['Username','Password']:['Display name','Username','Password','Confirm password']) {
      const field=screen.getByLabelText(label);
      expect(field).toBeRequired();
      expect(field).toHaveAttribute('aria-required','true');
      expect(field).toHaveAttribute('aria-invalid','true');
      expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveAttribute('role','alert');
    }
    expect(readSession().value).toBeNull();
  });
  it('uses password input semantics and retains wrong credentials without navigating', async () => {
    const user=userEvent.setup();authView();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type','password');
    await user.type(screen.getByLabelText('Username'),'admin');
    await user.type(screen.getByLabelText('Password'),'wrong');
    await user.click(screen.getByRole('button',{name:'Log in',exact:true}));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong');
    expect(readSession().value).toBeNull();
  });
  it.each(['user','admin'])('logs stored %s into its confirmed destination', async (role) => {
    localStorage.setItem(USERS_KEY,JSON.stringify([{id:'u1',username:'mira',displayName:'Mira',password:'demo',role,createdAt:'today'}]));
    const user=userEvent.setup();authView();
    await user.type(screen.getByLabelText('Username'),'mira');
    await user.type(screen.getByLabelText('Password'),'demo');
    await user.click(screen.getByRole('button',{name:'Log in',exact:true}));
    expect(screen.getByText(role==='admin'?'Admin destination':'Writer destination')).toBeVisible();
    expect(readSession().value).not.toHaveProperty('password');
  });
  it('logs fixed admin in and keeps login fields when a save fails', async () => {
    const user=userEvent.setup();authView();
    await user.type(screen.getByLabelText('Username'),'admin');
    await user.type(screen.getByLabelText('Password'),'admin');
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
    await user.click(screen.getByRole('button',{name:'Log in',exact:true}));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('admin');write.mockRestore();
    await user.click(screen.getByRole('button',{name:'Log in',exact:true}));
    expect(screen.getByText('Admin destination')).toBeVisible();
  });
  it('navigates between auth pages and registers through real helper persistence', async () => {
    const user=userEvent.setup();authView();
    await user.click(screen.getAllByRole('link',{name:'Register',exact:true}).at(-1));
    await fillRegistration(user);
    await user.click(screen.getByRole('button',{name:'Register',exact:true}));
    expect(screen.getByText('Writer destination')).toBeVisible();
    expect(readUsers().value[0]).toMatchObject({username:'mira',displayName:'Mira',password:' demo '});
  });
  it('retains registration input on mismatch, duplicate and collection failure', async () => {
    const user=userEvent.setup();authView('/register');await fillRegistration(user);
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'),'wrong');
    await user.click(screen.getByRole('button',{name:'Register',exact:true}));
    expect(screen.getByText('Passwords must match.')).toBeVisible();
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'),' demo ');
    localStorage.setItem(USERS_KEY,JSON.stringify([{id:'u1',username:'mira',displayName:'Mira',password:'demo',role:'user',createdAt:'today'}]));
    await user.click(screen.getByRole('button',{name:'Register',exact:true}));
    expect(screen.getByText('This username is already taken.')).toBeVisible();
    localStorage.setItem(USERS_KEY,'{bad');
    await user.click(screen.getByRole('button',{name:'Register',exact:true}));
    expect(screen.getByRole('alert')).toHaveTextContent('cannot be read');
    expect(screen.getByLabelText('Display name')).toHaveValue(' Mira ');
    expect(screen.getByLabelText('Password')).toHaveValue(' demo ');
    expect(localStorage.getItem(USERS_KEY)).toBe('{bad');
  });
  it('retains registration fields on user save failure', async () => {
    const user=userEvent.setup();authView('/register');await fillRegistration(user);
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
    await user.click(screen.getByRole('button',{name:'Register',exact:true}));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByLabelText('Password')).toHaveValue(' demo ');
    expect(readUsers().value).toEqual([]);
  });
  it('offers login recovery and prevents repeat registration after partial completion', async () => {
    const user=userEvent.setup();authView('/register');await fillRegistration(user);
    const original=Storage.prototype.setItem;
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value){
      if(key===SESSION_KEY)throw new Error('quota');original.call(this,key,value);
    });
    await user.click(screen.getByRole('button',{name:'Register',exact:true}));
    expect(screen.getByRole('alert')).toHaveTextContent('account was saved, but sign-in failed');
    expect(screen.getByRole('button',{name:'Register',exact:true})).toBeDisabled();
    expect(screen.getByLabelText('Password')).toHaveValue(' demo ');
    expect(readUsers().value).toHaveLength(1);write.mockRestore();
    await user.click(screen.getAllByRole('link',{name:'Log in',exact:true}).at(-1));
    await user.type(screen.getByLabelText('Username'),'mira');
    await user.type(screen.getByLabelText('Password'),' demo ');
    await user.click(screen.getByRole('button',{name:'Log in',exact:true}));
    expect(screen.getByText('Writer destination')).toBeVisible();
  });
});
describe('role navigation and avatars',()=>{
  it.each(['user','admin'])('renders accessible inline SVG %s identity',role=>{
    const {container}=render(<Avatar role={role} displayName="Mira" />);
    expect(screen.getByRole('img')).toHaveAccessibleName(role==='admin'?'Mira — Administrator':'Mira — Writer');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden','true');
    expect(container.querySelector('path').getAttribute('d')).toContain(role==='admin'?'M4 18':'M12 6');
  });
  it.each(['user','admin'])('offers role links and activated logout for %s',async role=>{
    writeSession({...identity,role});const user=userEvent.setup();authView('/write');
    const remove=vi.spyOn(Storage.prototype,'removeItem');
    expect(screen.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('href',role==='admin'?'/admin':'/blogs');
    expect(screen.getByRole('link',{name:'All Blogs',exact:true})).toHaveAttribute('href','/blogs');
    expect(screen.getByRole('link',{name:'Write',exact:true})).toHaveAttribute('href','/write');
    if (role === 'admin') expect(screen.getByRole('link',{name:'Users',exact:true})).toHaveAttribute('href','/users');
    else expect(screen.queryByRole('link',{name:'Users',exact:true})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Log out'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:/Mira/}));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:/Mira/})).toHaveAttribute('aria-expanded','true');
    await user.click(screen.getByRole('button',{name:'Log out'}));
    expect(readSession().value).toBeNull();
    expect(screen.getByLabelText('Current address').textContent).toBe('/');
    expect(screen.getByText('Public destination')).toBeVisible();
    expect(screen.queryByRole('button',{name:/Mira/})).not.toBeInTheDocument();
  });
  it('keeps identity and open logout action on removal failure then supports retry',async()=>{
    writeSession(identity);const user=userEvent.setup();authView('/write');
    await user.click(screen.getByRole('button',{name:/Mira/}));
    const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('blocked');});
    await user.click(screen.getByRole('button',{name:'Log out'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign out');
    expect(readSession().value).toEqual(identity);
    expect(screen.getByLabelText('Current address').textContent).toBe('/write');
    expect(screen.getByRole('button',{name:/Mira/})).toHaveAttribute('aria-expanded','true');
    expect(screen.getByRole('button',{name:'Log out'})).toBeVisible();remove.mockRestore();
    await user.click(screen.getByRole('button',{name:'Log out'}));
    expect(readSession().value).toBeNull();
    expect(screen.getByLabelText('Current address').textContent).toBe('/');
  });
  it('toggles mobile disclosure, closes on route activation and escape',async()=>{
    writeSession({...identity,role:'admin'});const user=userEvent.setup();authView('/');
    const toggle=screen.getByRole('button',{name:'Toggle navigation'});
    await user.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','true');
    await user.click(screen.getByRole('button',{name:/Mira/}));
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded','false');
    expect(screen.queryByRole('button',{name:'Log out'})).not.toBeInTheDocument();
    await user.click(toggle);
    await user.click(screen.getByRole('link',{name:'Users',exact:true}));
    expect(screen.getByText('Accounts destination')).toBeVisible();
    expect(toggle).toHaveAttribute('aria-expanded','false');
    expect(screen.queryByRole('button',{name:'Log out'})).not.toBeInTheDocument();
  });
  it('refreshes navigation on relevant storage events and ignores unrelated keys',()=>{
    authView('/');writeSession(identity);
    act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'unrelated'})));
    expect(screen.queryByRole('button',{name:/Mira/})).not.toBeInTheDocument();
    act(()=>window.dispatchEvent(new StorageEvent('storage',{key:SESSION_KEY})));
    expect(screen.getByRole('button',{name:/Mira/})).toBeVisible();
    localStorage.clear();act(()=>window.dispatchEvent(new StorageEvent('storage',{key:null})));
    expect(screen.queryByRole('button',{name:/Mira/})).not.toBeInTheDocument();
  });
});

it.each([
  ['admin', '/admin', 'Home'], ['admin', '/blogs', 'All Blogs'],
  ['admin', '/write', 'Write'], ['admin', '/users', 'Users'],
  ['user', '/blogs', 'All Blogs'], ['user', '/write', 'Write'],
])('marks %s navigation at %s with current-page semantics and indigo treatment', (role, path, activeName) => {
  writeSession({...identity, role});
  authView(path);
  const links = screen.getByRole('navigation', {name:'Main navigation'}).querySelectorAll('a[aria-current="page"]');
  expect(links).toHaveLength(1);
  const active = screen.getByRole('link', {name:activeName, exact:true});
  expect(active).toHaveAttribute('aria-current','page');
  expect(active).toHaveClass('rounded-control', 'bg-primary-50', 'text-primary-700');
  for (const name of ['Home', 'All Blogs', 'Write', ...(role === 'admin' ? ['Users'] : [])]) {
    if (name !== activeName) {
      const inactive = screen.getByRole('link',{name, exact:true});
      expect(inactive).not.toHaveAttribute('aria-current','page');
      expect(inactive).not.toHaveClass('bg-primary-50');
    }
  }
});

it('activates writer navigation without modifying stored identity', async () => {
  writeSession(identity);
  const user = userEvent.setup();
  authView('/');
  await user.click(screen.getByRole('button', { name: 'Toggle navigation' }));
  await user.click(screen.getByRole('link', { name: 'Write', exact: true }));
  expect(screen.getByText('Write destination')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Write', exact: true })).toHaveClass('bg-primary-50', 'text-primary-700', 'rounded-control');
  expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(readSession().value).toEqual(identity);
});
