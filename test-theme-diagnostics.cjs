#!/usr/bin/env node

/**
 * Comprehensive Theme Diagnostics
 * Checks CSS variables, localStorage, and sidebar styling
 */

const puppeteer = require('puppeteer');

async function run() {
  console.log('🔍 Starting comprehensive theme diagnostics...\n');
  
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
    
    console.log('📸 Taking screenshot');
    await page.screenshot({ path: 'screenshot-diagnostics.png', fullPage: true });
    console.log('   ✅ Saved: screenshot-diagnostics.png\n');
    
    // Check CSS Variables
    console.log('🎨 Checking CSS Variables:');
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        primary: styles.getPropertyValue('--color-fd-primary').trim(),
        primaryFg: styles.getPropertyValue('--color-fd-primary-foreground').trim(),
        background: styles.getPropertyValue('--color-fd-background').trim(),
        foreground: styles.getPropertyValue('--color-fd-foreground').trim(),
        border: styles.getPropertyValue('--color-fd-border').trim(),
        muted: styles.getPropertyValue('--color-fd-muted').trim(),
        mutedFg: styles.getPropertyValue('--color-fd-muted-foreground').trim(),
        card: styles.getPropertyValue('--color-fd-card').trim(),
        accent: styles.getPropertyValue('--color-fd-accent').trim(),
        ring: styles.getPropertyValue('--color-fd-ring').trim(),
        isDark: root.classList.contains('dark'),
        htmlClasses: root.className,
        hasStyleTags: document.querySelectorAll('style').length,
      };
    });
    console.log(JSON.stringify(cssVars, null, 2));
    
    // Check localStorage
    console.log('\n💾 Checking localStorage:');
    const localStorage = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage).filter(k => 
        k.includes('theme') || k.includes('preset') || k.includes('customizer') || k.includes('color')
      );
      return {
        allKeys: Object.keys(window.localStorage),
        themeKeys: keys,
        values: keys.reduce((a, k) => { 
          a[k] = window.localStorage.getItem(k); 
          return a; 
        }, {})
      };
    });
    console.log(JSON.stringify(localStorage, null, 2));
    
    // Check sidebar styling
    console.log('\n📦 Checking sidebar styling:');
    const sidebarStyle = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      if (!sidebar) return { error: 'Sidebar not found' };
      
      const s = getComputedStyle(sidebar);
      return {
        borderRight: s.borderRight,
        borderRightWidth: s.borderRightWidth,
        borderRightStyle: s.borderRightStyle,
        borderRightColor: s.borderRightColor,
        borderLeft: s.borderLeft,
        border: s.border,
        boxShadow: s.boxShadow,
        background: s.backgroundColor,
        width: s.width,
        hasBorder: s.borderRightWidth !== '0px' && s.borderRightStyle !== 'none'
      };
    });
    console.log(JSON.stringify(sidebarStyle, null, 2));
    
    // Check for injected style tags
    console.log('\n🏷️  Checking injected style tags:');
    const styleTags = await page.evaluate(() => {
      const tags = document.querySelectorAll('style');
      const info = [];
      tags.forEach((tag, i) => {
        const content = tag.innerHTML;
        const hasColors = content.includes('--color-fd-');
        const hasCustomizer = content.includes('data-customizer');
        const hasImportant = content.includes('!important');
        info.push({
          index: i,
          length: content.length,
          hasColors,
          hasCustomizer,
          hasImportant,
          preview: content.substring(0, 200).replace(/\n/g, ' ')
        });
      });
      return info;
    });
    console.log(JSON.stringify(styleTags, null, 2));
    
    // Check active sidebar item
    console.log('\n📌 Checking active sidebar item styling:');
    const activeSidebar = await page.evaluate(() => {
      const activeLink = document.querySelector('aside a[data-active="true"]');
      if (!activeLink) return { error: 'No active link found' };
      
      const s = getComputedStyle(activeLink);
      return {
        text: activeLink.textContent?.trim(),
        color: s.color,
        backgroundColor: s.backgroundColor,
        fontWeight: s.fontWeight,
        hasIcon: activeLink.querySelector('svg') !== null,
        iconVisible: activeLink.querySelector('svg') ? 
          getComputedStyle(activeLink.querySelector('svg')).display !== 'none' : false
      };
    });
    console.log(JSON.stringify(activeSidebar, null, 2));
    
    // Check computed body background
    console.log('\n🎨 Checking body background:');
    const bodyStyle = await page.evaluate(() => {
      const body = document.body;
      const s = getComputedStyle(body);
      return {
        backgroundColor: s.backgroundColor,
        color: s.color,
        classes: body.className
      };
    });
    console.log(JSON.stringify(bodyStyle, null, 2));
    
    console.log('\n✅ Diagnostics complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Primary color: ${cssVars.primary}`);
    console.log(`   - Background: ${cssVars.background}`);
    console.log(`   - Dark mode: ${cssVars.isDark ? 'YES' : 'NO'}`);
    console.log(`   - Sidebar border: ${sidebarStyle.hasBorder ? 'YES' : 'NO'}`);
    console.log(`   - Active item color: ${activeSidebar.color || 'N/A'}`);
    console.log(`   - Style tags: ${cssVars.hasStyleTags}`);
    console.log(`   - LocalStorage theme keys: ${localStorage.themeKeys.length}`);
    
  } catch (error) {
    console.error('\n❌ Error during diagnostics:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
