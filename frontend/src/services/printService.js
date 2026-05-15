import React from 'react';
import { createRoot } from 'react-dom/client';
import toast from 'react-hot-toast';
import ReceiptTemplate from '../components/ReceiptTemplate';

const getAgentUrl = () => localStorage.getItem('printAgentUrl') || 'http://localhost:9100';

export async function printReceipt(saleData, autoPrint = false) {
  const agentUrl = getAgentUrl();
  const payload = { sale: saleData };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(`${agentUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Agent ${res.status}: ${errText}`);
    }
    
    toast.success('Receipt printed');
    return { method: 'agent', success: true };
  } catch (err) {
    console.warn('[printService] Agent unreachable:', err.message);
    if (autoPrint) {
      toast.error('Printer agent offline. Bill not printed.', { icon: '⚠️' });
      return { method: 'none', success: false };
    } else {
      toast('Printer offline — using browser print', { icon: '⚠️' });
      return browserPrintFallback(saleData);
    }
  }
}

export async function checkAgentHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${getAgentUrl()}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export async function openCashDrawer() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${getAgentUrl()}/open-drawer`, { 
      method: 'POST',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (res.ok) toast.success('Drawer opened');
    else toast.error('Could not open drawer');
  } catch (err) {
    toast.error('Printer agent offline');
  }
}

function browserPrintFallback(saleData) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write('<html><head><title>Print Receipt</title></head><body style="margin:0;padding:0;"><div id="print-root"></div></body></html>');
    doc.close();

    const root = createRoot(doc.getElementById('print-root'));
    // Using createElement to avoid JSX syntax in a .js file, which Vite might complain about
    root.render(React.createElement(ReceiptTemplate, { sale: saleData }));

    // Wait for render
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Browser print failed', e);
      }
      
      // Cleanup after print dialog closes
      setTimeout(() => {
        root.unmount();
        document.body.removeChild(iframe);
        resolve({ method: 'browser', success: true });
      }, 1000);
    }, 500);
  });
}
