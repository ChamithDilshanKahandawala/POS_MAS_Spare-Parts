import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Facebook, Instagram, Youtube, Mail, Phone, MapPin, 
  ShieldCheck, Truck, Clock, Facebook as WhatsApp 
} from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerStyle = {
    background: 'var(--bg-card)',
    borderTop: '1px solid var(--border-light)',
    padding: '60px 0 20px',
    marginTop: '60px',
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '40px',
  };

  const sectionTitleStyle = {
    fontSize: '16px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '20px',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  const linkStyle = {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '14px',
    display: 'block',
    marginBottom: '10px',
    transition: 'color 0.2s',
  };

  const iconInfoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '15px',
    color: 'var(--text-muted)',
    fontSize: '14px'
  };

  return (
    <footer style={footerStyle}>
      <div style={containerStyle}>
        
        {/* Brand Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-primary)' }}>MUDIYANSE</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
            Your premium destination for high-quality vehicle spare parts in Sri Lanka. 
            Reliability and speed, delivered to your doorstep.
          </p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <Facebook size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
            <Instagram size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
            <WhatsApp size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={sectionTitleStyle}>Quick Shop</h4>
          <Link to="/?category=Bike" style={linkStyle}>Bike Spare Parts</Link>
          <Link to="/?category=Car" style={linkStyle}>Car Accessories</Link>
          <Link to="/?category=Three-Wheel" style={linkStyle}>Three-Wheel Parts</Link>
          <Link to="/orders" style={linkStyle}>Track My Order</Link>
        </div>

        {/* Support & Policy */}
        <div>
          <h4 style={sectionTitleStyle}>Customer Support</h4>
          <Link to="#" style={linkStyle}>Privacy Policy</Link>
          <Link to="#" style={linkStyle}>Terms & Conditions</Link>
          <Link to="#" style={linkStyle}>Return & Refund Policy</Link>
          <Link to="#" style={linkStyle}>Shipping Information</Link>
        </div>

        {/* Contact Info */}
        <div>
          <h4 style={sectionTitleStyle}>Contact Us</h4>
          <div style={iconInfoStyle}>
            <MapPin size={18} color="var(--accent-primary)" />
            <span>123, Auto Plaza, Kandy Road, Sri Lanka</span>
          </div>
          <div style={iconInfoStyle}>
            <Phone size={18} color="var(--accent-primary)" />
            <span>+94 77 123 4567</span>
          </div>
          <div style={iconInfoStyle}>
            <Mail size={18} color="var(--accent-primary)" />
            <span>support@mudiyanseauto.lk</span>
          </div>
          <div style={iconInfoStyle}>
            <Clock size={18} color="var(--accent-primary)" />
            <span>Mon - Sat: 8:00 AM - 6:00 PM</span>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div style={{ 
        maxWidth: '1200px', margin: '40px auto 0', padding: '20px', 
        borderTop: '1px solid var(--border-light)', display: 'flex', 
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' 
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          © {currentYear} Mudiyanse Auto Solutions. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} color="#10b981" /> Secure Payments
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Truck size={14} color="#6366f1" /> Island-wide Delivery
          </div>
        </div>
      </div>
    </footer>
  );
}