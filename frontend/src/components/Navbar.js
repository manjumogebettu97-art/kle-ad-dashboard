import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import BrandMark from './GoogleAdsLogo';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { platform, setPlatform, theme } = usePlatform();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <BrandMark
          size={36}
          withText
          secondaryText={`${theme.name} Dashboard`}
          textColor="#202124"
          palette={theme.logo}
        />
      </div>

      <div style={styles.links}>
        <NavLink to="/"           style={(state) => navStyle(state, theme)} end>Dashboard</NavLink>
        <NavLink to="/ads"        style={(state) => navStyle(state, theme)}>Ads</NavLink>
        <NavLink to="/locations"  style={(state) => navStyle(state, theme)}>Geo Performance</NavLink>
        <NavLink to="/placements" style={(state) => navStyle(state, theme)}>Targeted Content</NavLink>
        {isAdmin && (
          <NavLink to="/settings" style={(state) => navStyle(state, theme)}>Settings</NavLink>
        )}
      </div>

      <div style={styles.platformSwitch} aria-label="Platform switcher">
        <button
          type="button"
          onClick={() => setPlatform('google')}
          style={platformButton(platform === 'google', theme)}
        >
          Google Ads
        </button>
        <button
          type="button"
          onClick={() => setPlatform('linkedin')}
          style={platformButton(platform === 'linkedin', theme)}
        >
          LinkedIn Ads
        </button>
      </div>

      <div style={styles.user}>
        <div style={{ ...styles.avatar, background: theme.primary }}>{user?.name?.charAt(0).toUpperCase()}</div>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{user?.name}</span>
          <span style={styles.userRole}>{user?.role}</span>
        </div>
        <button className="btn btn-outline" onClick={handleLogout} style={{ marginLeft: '.5rem', fontSize: '.8rem' }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

function navStyle({ isActive }, theme) {
  return {
    padding: '.4rem .85rem',
    borderRadius: 4,
    fontSize: '.8rem',
    fontWeight: 500,
    color: isActive ? theme.primary : '#5F6368',
    background: isActive ? theme.primaryLight : 'transparent',
    transition: 'background .15s, color .15s',
  };
}

function platformButton(active, theme) {
  return {
    border: `1px solid ${active ? theme.primary : '#DADCE0'}`,
    background: active ? theme.primary : '#fff',
    color: active ? '#fff' : '#3C4043',
    borderRadius: 4,
    padding: '.34rem .62rem',
    fontSize: '.74rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    boxShadow: active ? '0 1px 2px rgba(60,64,67,.12)' : 'none',
  };
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.2rem',
    padding: '0 1.25rem',
    height: 58,
    background: '#FFFFFF',
    borderBottom: '1px solid #E8EAED',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    marginRight: '.5rem',
  },
  links: {
    display: 'flex',
    gap: '.25rem',
    flex: 1,
    marginLeft: '1rem',
  },
  platformSwitch: {
    display: 'inline-flex',
    gap: 4,
    padding: 3,
    border: '1px solid #DADCE0',
    borderRadius: 6,
    background: '#F8F9FA',
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '.5rem',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#1A73E8',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '.875rem',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.2,
  },
  userName: {
    fontSize: '.78rem',
    fontWeight: 600,
    color: '#202124',
  },
  userRole: {
    fontSize: '.66rem',
    color: '#5F6368',
    textTransform: 'capitalize',
  },
};
