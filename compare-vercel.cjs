#!/usr/bin/env node

/**
 * Side-by-side comparison: Our Vercel theme vs Real Vercel docs
 */

const puppeteer = require('puppeteer');

async function run() {
  console.log('📸 Starting screenshot comparison...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Screenshot 1: Our Vercel theme
    console.log('📍 1. Navigating to http://localhost:3000/docs');
    await page.goto('http://localhost:3000/docs', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📸 Taking screenshot of our Vercel theme');
    await page.screenshot({ 
      path: 'our-vercel-theme.png', 
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('   ✅ Saved: our-vercel-theme.png\n');
    
    // Analyze our theme
    const ourTheme = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
      const sidebarLinks = document.querySelectorAll('aside a');
      const firstLink = sidebarLinks[0];
      const linkStyle = firstLink ? getComputedStyle(firstLink) : null;
      
      const header = document.querySelector('header, [role="banner"]');
      const headerStyle = header ? getComputedStyle(header) : null;
      
      const body = document.body;
      const bodyStyle = getComputedStyle(body);
      
      return {
        sidebar: {
          exists: !!sidebar,
          background: sidebarStyle?.backgroundColor,
          borderRight: sidebarStyle?.borderRight,
          hasBorder: sidebarStyle?.borderRightWidth !== '0px',
          width: sidebarStyle?.width,
          linkCount: sidebarLinks.length,
          linkFontSize: linkStyle?.fontSize,
          linkColor: linkStyle?.color,
          linkPadding: linkStyle?.padding,
          hasIcons: Array.from(sidebarLinks).some(link => link.querySelector('svg') !== null),
          iconsVisible: Array.from(sidebarLinks).some(link => {
            const svg = link.querySelector('svg');
            return svg && getComputedStyle(svg).display !== 'none';
          })
        },
        header: {
          exists: !!header,
          background: headerStyle?.backgroundColor,
          borderBottom: headerStyle?.borderBottom,
          height: headerStyle?.height
        },
        body: {
          background: bodyStyle.backgroundColor,
          color: bodyStyle.color
        },
        root: {
          primary: getComputedStyle(document.documentElement).getPropertyValue('--color-fd-primary').trim(),
          background: getComputedStyle(document.documentElement).getPropertyValue('--color-fd-background').trim()
        }
      };
    });
    
    console.log('🔍 Our theme analysis:');
    console.log(JSON.stringify(ourTheme, null, 2));
    console.log('');
    
    // Screenshot 2: Real Vercel docs
    console.log('📍 2. Navigating to https://vercel.com/docs');
    await page.goto('https://vercel.com/docs', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to accept cookies if dialog appears
    try {
      const cookieButton = await page.$('button[class*="cookie"], button[class*="accept"]');
      if (cookieButton) {
        await cookieButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      // Ignore if no cookie dialog
    }
    
    console.log('📸 Taking screenshot of real Vercel docs');
    await page.screenshot({ 
      path: 'real-vercel-docs.png', 
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('   ✅ Saved: real-vercel-docs.png\n');
    
    // Analyze real Vercel
    const realVercel = await page.evaluate(() => {
      const sidebar = document.querySelector('nav[class*="sidebar"], aside, [role="navigation"]');
      const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
      
      const sidebarLinks = document.querySelectorAll('nav a, aside a');
      const firstLink = sidebarLinks[0];
      const linkStyle = firstLink ? getComputedStyle(firstLink) : null;
      
      const header = document.querySelector('header, [role="banner"]');
      const headerStyle = header ? getComputedStyle(header) : null;
      
      const body = document.body;
      const bodyStyle = getComputedStyle(body);
      
      return {
        sidebar: {
          exists: !!sidebar,
          selector: sidebar?.tagName,
          background: sidebarStyle?.backgroundColor,
          borderRight: sidebarStyle?.borderRight,
          hasBorder: sidebarStyle?.borderRightWidth !== '0px',
          width: sidebarStyle?.width,
          linkCount: sidebarLinks.length,
          linkFontSize: linkStyle?.fontSize,
          linkColor: linkStyle?.color,
          linkPadding: linkStyle?.padding,
          hasIcons: Array.from(sidebarLinks).slice(0, 5).some(link => 
            link.querySelector('svg, img') !== null
          )
        },
        header: {
          exists: !!header,
          background: headerStyle?.backgroundColor,
          borderBottom: headerStyle?.borderBottom,
          height: headerStyle?.height
        },
        body: {
          background: bodyStyle.backgroundColor,
          color: bodyStyle.color
        }
      };
    });
    
    console.log('🔍 Real Vercel analysis:');
    console.log(JSON.stringify(realVercel, null, 2));
    console.log('');
    
    console.log('✅ Screenshot comparison complete!');
    console.log('\n📊 Side-by-side files:');
    console.log('   - our-vercel-theme.png');
    console.log('   - real-vercel-docs.png');
    
  } catch (error) {
    console.error('\n❌ Error during comparison:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
