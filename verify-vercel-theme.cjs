#!/usr/bin/env node

/**
 * Final Vercel Theme Verification
 * Checks all visual elements after CSS fix
 */

const puppeteer = require('puppeteer');

async function run() {
  console.log('🔍 Final Vercel Theme Verification...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('📍 Navigating to http://localhost:3000/docs (fresh load)');
    await page.goto('http://localhost:3000/docs', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📸 Taking verification screenshot');
    await page.screenshot({ 
      path: 'vercel-theme-final.png', 
      fullPage: true 
    });
    console.log('   ✅ Saved: vercel-theme-final.png\n');
    
    // Comprehensive verification
    console.log('🔍 DETAILED VERIFICATION:\n');
    
    const verification = await page.evaluate(() => {
      const results = {
        sidebar: {},
        sidebarLinks: [],
        expandableItems: [],
        icons: {},
        colors: {},
        buttons: {}
      };
      
      // 1. Sidebar analysis
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        const sidebarStyle = getComputedStyle(sidebar);
        results.sidebar = {
          exists: true,
          background: sidebarStyle.backgroundColor,
          borderRight: sidebarStyle.borderRight,
          borderRightWidth: sidebarStyle.borderRightWidth,
          hasBorder: sidebarStyle.borderRightWidth !== '0px',
        };
        
        // 2. Check sidebar links
        const links = sidebar.querySelectorAll('a');
        links.forEach((link, i) => {
          const linkData = {
            index: i,
            text: link.textContent?.trim().substring(0, 30),
            hasIcon: link.querySelector('svg') !== null || link.querySelector('img') !== null,
          };
          
          if (linkData.hasIcon) {
            const icon = link.querySelector('svg') || link.querySelector('img');
            const iconStyle = icon ? getComputedStyle(icon) : null;
            linkData.iconVisible = iconStyle ? iconStyle.display !== 'none' : false;
          }
          
          results.sidebarLinks.push(linkData);
        });
        
        // 3. Check expandable items (buttons/summary)
        const buttons = sidebar.querySelectorAll('button, summary');
        buttons.forEach((btn, i) => {
          const text = btn.textContent?.trim().substring(0, 30);
          const chevron = btn.querySelector('svg');
          if (text && text.length > 0 && text !== 'Search') {
            results.expandableItems.push({
              index: i,
              text: text,
              tag: btn.tagName,
              hasChevron: chevron !== null,
              chevronVisible: chevron ? getComputedStyle(chevron).display !== 'none' : false
            });
          }
        });
      }
      
      // 4. Check specific icons
      const searchButton = document.querySelector('[data-search], [data-search-full], button[class*="search"]');
      if (searchButton) {
        const searchIcon = searchButton.querySelector('svg');
        results.icons.search = {
          exists: searchIcon !== null,
          visible: searchIcon ? getComputedStyle(searchIcon).display !== 'none' : false
        };
      }
      
      const themeToggle = document.querySelector('button[aria-label*="theme"], button[class*="theme"]');
      if (themeToggle) {
        const themeIcon = themeToggle.querySelector('svg');
        results.icons.themeToggle = {
          exists: themeIcon !== null,
          visible: themeIcon ? getComputedStyle(themeIcon).display !== 'none' : false,
          location: 'found'
        };
      } else {
        results.icons.themeToggle = {
          exists: false,
          visible: false,
          location: 'not found'
        };
      }
      
      // 5. Check colors
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      results.colors = {
        primary: rootStyle.getPropertyValue('--color-fd-primary').trim(),
        background: rootStyle.getPropertyValue('--color-fd-background').trim(),
        foreground: rootStyle.getPropertyValue('--color-fd-foreground').trim(),
        isDark: root.classList.contains('dark')
      };
      
      // 6. Check active link color
      const activeLink = sidebar?.querySelector('a[data-active="true"]');
      if (activeLink) {
        const activeStyle = getComputedStyle(activeLink);
        results.colors.activeLink = {
          color: activeStyle.color,
          text: activeLink.textContent?.trim()
        };
      }
      
      return results;
    });
    
    // Print results
    console.log('1️⃣  SIDEBAR TEXT-ONLY CHECK:');
    const linksWithIcons = verification.sidebarLinks.filter(l => l.hasIcon && l.iconVisible);
    if (linksWithIcons.length === 0) {
      console.log('   ✅ PASS: All sidebar links are text-only (no document icons)');
    } else {
      console.log(`   ❌ FAIL: ${linksWithIcons.length} links still show icons:`);
      linksWithIcons.forEach(l => console.log(`      - ${l.text}`));
    }
    console.log('');
    
    console.log('2️⃣  EXPANDABLE CHEVRONS CHECK:');
    if (verification.expandableItems.length > 0) {
      console.log(`   Found ${verification.expandableItems.length} expandable items:`);
      verification.expandableItems.forEach(item => {
        const status = item.chevronVisible ? '✅ Visible' : '❌ Hidden';
        console.log(`   ${status}: "${item.text}" (${item.tag})`);
      });
    } else {
      console.log('   ⚠️  No expandable items found');
    }
    console.log('');
    
    console.log('3️⃣  SIDEBAR BORDER CHECK:');
    if (verification.sidebar.hasBorder) {
      console.log(`   ❌ FAIL: Sidebar has border: ${verification.sidebar.borderRight}`);
    } else {
      console.log('   ✅ PASS: Sidebar is borderless');
    }
    console.log('');
    
    console.log('4️⃣  COLOR MONOCHROME CHECK:');
    console.log(`   Primary: ${verification.colors.primary}`);
    console.log(`   Background: ${verification.colors.background}`);
    console.log(`   Foreground: ${verification.colors.foreground}`);
    if (verification.colors.activeLink) {
      console.log(`   Active link: ${verification.colors.activeLink.color} ("${verification.colors.activeLink.text}")`);
    }
    const isMonochrome = 
      verification.colors.primary === '#fff' || verification.colors.primary === '#ffffff';
    if (isMonochrome) {
      console.log('   ✅ PASS: Pure monochrome (white primary)');
    } else {
      console.log(`   ❌ FAIL: Not monochrome - primary is ${verification.colors.primary}`);
    }
    console.log('');
    
    console.log('5️⃣  SEARCH ICON CHECK:');
    if (verification.icons.search) {
      if (verification.icons.search.visible) {
        console.log('   ✅ PASS: Search icon is visible');
      } else {
        console.log('   ❌ FAIL: Search icon exists but hidden');
      }
    } else {
      console.log('   ❌ FAIL: Search icon not found');
    }
    console.log('');
    
    console.log('6️⃣  THEME TOGGLE ICON CHECK:');
    if (verification.icons.themeToggle) {
      if (verification.icons.themeToggle.visible) {
        console.log('   ✅ PASS: Theme toggle icon is visible');
      } else if (verification.icons.themeToggle.exists) {
        console.log('   ❌ FAIL: Theme toggle icon exists but hidden');
      } else {
        console.log('   ⚠️  Theme toggle not found (might be in different location)');
      }
    }
    console.log('');
    
    console.log('📊 FULL VERIFICATION DATA:');
    console.log(JSON.stringify(verification, null, 2));
    
    console.log('\n✅ Verification complete!');
    console.log('📸 Screenshot saved: vercel-theme-final.png');
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
